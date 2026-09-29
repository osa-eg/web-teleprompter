import { toWesternDigits } from './arabic';
import type { Block, Cue, Dir, Inline, Line, Marker, ScriptDoc, Token, WordPart } from './ast';
import { countDirWords, detectLineDir } from './direction';
import { wordSegmenter } from './stats';

/**
 * Teleprompter markup
 * -------------------
 *   blank line              new block (paragraph)
 *   # / ## / ### Title      section heading, used as a jump marker
 *   **strong**  *em* _em_  ==highlight==
 *   [[note]]                director note: shown dimmed, never read aloud
 *   [pause] [pause 3]       pause cue (also [توقف], [وقفة ٣], [wait 2s], [انتظر ٢ث])
 *   \* \_ \= \[ \] \# \\    literal characters
 * Every line of a paragraph keeps its own text direction.
 */

export interface ParseOptions {
  /** `auto` resolves each line from its words; `rtl`/`ltr` force every line. */
  direction?: 'auto' | Dir;
  /** Direction used when the script has no letters at all. */
  fallbackDir?: Dir;
}

type Delim = '**' | '==' | '*' | '_';
type TokenKind = 'word' | 'heading' | 'none';

const HEADING_RE = /^\s{0,3}(#{1,3})\s+(.*?)\s*$/;
const CUE_BODY = String.raw`(?:pause|wait|توقف|وقفة|انتظر)(?:\s+(\p{Nd}+(?:[.,]\p{Nd}+)?)\s*(?:s|sec|secs|seconds?|ث|ثانية|ثوان|ثواني)?)?`;
const CUE_AT = new RegExp(String.raw`\[\s*${CUE_BODY}\s*\]`, 'iuy');
const CUE_LINE = new RegExp(String.raw`^\s*\[\s*${CUE_BODY}\s*\]\s*$`, 'iu');
const ESCAPABLE = new Set(['\\', '*', '_', '=', '[', ']', '#']);
const BLANK_RE = /^\s*$/;

const isSpace = (c: string | undefined) => c === undefined || /\s/u.test(c);
const isAlnum = (c: string | undefined) => c !== undefined && /[\p{L}\p{N}]/u.test(c);

function parseSeconds(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const value = Number(toWesternDigits(raw).replace(',', '.'));
  return Number.isFinite(value) && value > 0 ? Math.min(value, 3600) : undefined;
}

function delimAt(s: string, i: number, end: number): Delim | null {
  const c = s[i];
  if (c === '*') return i + 1 < end && s[i + 1] === '*' ? '**' : '*';
  if (c === '=') return i + 1 < end && s[i + 1] === '=' ? '==' : null;
  if (c === '_') return '_';
  return null;
}

function canOpen(s: string, i: number, d: Delim, end: number): boolean {
  const after = i + d.length < end ? s[i + d.length] : undefined;
  if (isSpace(after)) return false;
  return !(d === '_' && isAlnum(s[i - 1]));
}

function canClose(s: string, i: number, d: Delim, start: number, end: number): boolean {
  const before = i > start ? s[i - 1] : undefined;
  if (isSpace(before)) return false;
  return !(d === '_' && isAlnum(i + d.length < end ? s[i + d.length] : undefined));
}

/** Finds the end of `[[note]]` starting at `from` (just after `[[`), or -1. */
function findNoteEnd(s: string, from: number, end: number): number {
  const close = s.indexOf(']]', from);
  return close >= 0 && close + 2 <= end ? close : -1;
}

function findCloser(s: string, d: Delim, from: number, end: number): number {
  let k = from;
  while (k < end) {
    const c = s[k];
    if (c === '\\' && k + 1 < end) {
      k += 2;
      continue;
    }
    if (c === '[' && s[k + 1] === '[') {
      const close = findNoteEnd(s, k + 2, end);
      if (close >= 0) {
        k = close + 2;
        continue;
      }
    }
    if (d === '**' && c === '*') {
      // In a run like `***` the strong closer is the last two stars, so `**a *b***` nests correctly.
      let run = 1;
      while (k + run < end && s[k + run] === '*') run++;
      if (run >= 2) {
        const at = k + run - 2;
        if (at > from && canClose(s, at, d, from, end)) return at;
        k += run;
        continue;
      }
    }
    const here = delimAt(s, k, end);
    if (here === d && k > from && canClose(s, k, d, from, end)) return k;
    k += here ? here.length : 1;
  }
  return -1;
}

export function plainText(inlines: Inline[]): string {
  let out = '';
  for (const node of inlines) {
    if (node.t === 'text') for (const p of node.parts) out += typeof p === 'string' ? p : p.s;
    else if (node.t !== 'cue') out += plainText(node.c);
  }
  return out;
}

class ScriptParser {
  private readonly tokens: Token[] = [];
  private readonly cues: Cue[] = [];
  private readonly markers: Marker[] = [];
  private readonly blocks: Block[] = [];
  private words = 0;
  private headingWords = 0;
  private chars = 0;
  private block = 0;
  private prevDir: Dir;
  private readonly segmenter = wordSegmenter();
  private readonly forced: Dir | null;
  private readonly dominant: Dir;

  constructor(forced: Dir | null, dominant: Dir) {
    this.forced = forced;
    this.dominant = dominant;
    this.prevDir = dominant;
  }

  parse(body: string): ScriptDoc {
    const lines = body.split('\n');
    let offset = 0;
    let para: { lines: Line[]; start: number; end: number } | null = null;

    const closePara = () => {
      if (para) this.blocks.push({ t: 'para', lines: para.lines, src: [para.start, para.end] });
      para = null;
    };

    for (const raw of lines) {
      const start = offset;
      const end = start + raw.length;
      offset = end + 1;

      if (BLANK_RE.test(raw)) {
        closePara();
        continue;
      }

      const heading = HEADING_RE.exec(raw);
      if (heading) {
        closePara();
        this.block = this.blocks.length;
        const level = heading[1]!.length as 1 | 2 | 3;
        const markerToken = this.tokens.length;
        const text = heading[2] ?? '';
        const c = this.inline(text, 0, text.length, 'heading');
        const title = plainText(c).trim();
        const marker = this.markers.length;
        this.markers.push({ block: this.block, token: markerToken, level, title });
        this.blocks.push({
          t: 'heading',
          level,
          line: { dir: this.lineDir(title), c },
          marker,
          src: [start, end],
        });
        continue;
      }

      const cueLine = CUE_LINE.exec(raw);
      if (cueLine) {
        closePara();
        this.block = this.blocks.length;
        const seconds = parseSeconds(cueLine[1]);
        const { cue, w } = this.addCue(seconds);
        this.blocks.push({ t: 'cue', cue, w, seconds, dir: this.prevDir, src: [start, end] });
        continue;
      }

      if (!para) {
        this.block = this.blocks.length;
        para = { lines: [], start, end };
      }
      const c = this.inline(raw, 0, raw.length, 'word');
      para.lines.push({ dir: this.lineDir(plainText(c)), c });
      para.end = end;
    }
    closePara();

    return {
      blocks: this.blocks,
      tokens: this.tokens,
      dominantDir: this.dominant,
      markers: this.markers,
      cues: this.cues,
      stats: { words: this.words, headingWords: this.headingWords, chars: this.chars },
    };
  }

  private lineDir(text: string): Dir {
    const dir = this.forced ?? detectLineDir(text, this.prevDir);
    this.prevDir = dir;
    return dir;
  }

  private addCue(seconds: number | undefined): { cue: number; w: number } {
    const w = this.tokens.length;
    this.tokens.push({ i: w, block: this.block, kind: 'cue', text: '' });
    const cue = this.cues.length;
    this.cues.push({ block: this.block, token: w, seconds });
    return { cue, w };
  }

  private text(text: string, kind: TokenKind): Inline {
    this.chars += text.replace(/\s/gu, '').length;
    if (kind === 'none') return { t: 'text', parts: [text] };
    const parts: (string | WordPart)[] = [];
    for (const { segment, isWordLike } of this.segmenter.segment(text)) {
      if (isWordLike) {
        const w = this.tokens.length;
        this.tokens.push({
          i: w,
          block: this.block,
          kind: kind === 'heading' ? 'heading' : 'word',
          text: segment,
        });
        if (kind === 'heading') this.headingWords++;
        else this.words++;
        parts.push({ w, s: segment });
      } else {
        const last = parts.length - 1;
        if (typeof parts[last] === 'string') parts[last] += segment;
        else parts.push(segment);
      }
    }
    return { t: 'text', parts };
  }

  /** Parses inline markup in s[start, end). */
  private inline(s: string, start: number, end: number, kind: TokenKind): Inline[] {
    const out: Inline[] = [];
    let buf = '';
    const flush = () => {
      if (buf) out.push(this.text(buf, kind));
      buf = '';
    };

    let i = start;
    while (i < end) {
      const c = s[i]!;

      if (c === '\\' && i + 1 < end && ESCAPABLE.has(s[i + 1]!)) {
        buf += s[i + 1];
        i += 2;
        continue;
      }

      if (c === '[' && s[i + 1] === '[') {
        const close = findNoteEnd(s, i + 2, end);
        if (close >= 0) {
          flush();
          out.push({ t: 'note', c: this.inline(s, i + 2, close, 'none') });
          i = close + 2;
          continue;
        }
      }

      if (c === '[' && kind === 'word') {
        CUE_AT.lastIndex = i;
        const match = CUE_AT.exec(s);
        if (match && i + match[0].length <= end) {
          flush();
          const seconds = parseSeconds(match[1]);
          const { cue, w } = this.addCue(seconds);
          out.push({ t: 'cue', cue, w, seconds });
          i += match[0].length;
          continue;
        }
      }

      const d = delimAt(s, i, end);
      if (d && canOpen(s, i, d, end)) {
        const close = findCloser(s, d, i + d.length, end);
        if (close >= 0) {
          flush();
          const type = d === '**' ? 'strong' : d === '==' ? 'mark' : 'em';
          out.push({ t: type, c: this.inline(s, i + d.length, close, kind) });
          i = close + d.length;
          continue;
        }
      }

      buf += c;
      i++;
    }
    flush();
    return out;
  }
}

/** Parses teleprompter markup into blocks, positional tokens, markers and cues. */
export function parseScript(body: string, options: ParseOptions = {}): ScriptDoc {
  const unmarked = body.charCodeAt(0) === 0xfeff ? body.slice(1) : body; // strip a byte-order mark
  const normalized = unmarked.replace(/\r\n?/g, '\n');
  const forced = options.direction && options.direction !== 'auto' ? options.direction : null;
  let dominant: Dir = forced ?? options.fallbackDir ?? 'ltr';
  if (!forced) {
    const { rtl, ltr } = countDirWords(normalized);
    if (rtl !== ltr) dominant = rtl > ltr ? 'rtl' : 'ltr';
  }
  return new ScriptParser(forced, dominant).parse(normalized);
}
