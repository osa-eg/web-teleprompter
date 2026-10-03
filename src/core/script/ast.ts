export type Dir = 'rtl' | 'ltr';

/** A word inside a text run; `w` is its positional token index in the whole script. */
export interface WordPart {
  w: number;
  s: string;
}

export type Inline =
  | { t: 'text'; parts: (string | WordPart)[] }
  | { t: 'strong' | 'em' | 'mark'; c: Inline[] }
  /** Director note: rendered dimmed, never spoken and never positional. */
  | { t: 'note'; c: Inline[] }
  /** Pause cue: a zero-width positional anchor. */
  | { t: 'cue'; cue: number; w: number; seconds?: number };

export interface Line {
  dir: Dir;
  c: Inline[];
}

/** `gap` is the number of blank lines typed between the block and the previous one (0 for the first). */
export type Block =
  | { t: 'heading'; level: 1 | 2 | 3; line: Line; marker: number; gap: number; src: [number, number] }
  | { t: 'para'; lines: Line[]; gap: number; src: [number, number] }
  | { t: 'cue'; cue: number; w: number; seconds?: number; dir: Dir; gap: number; src: [number, number] };

export interface Token {
  /** Positional index (equals the position in `ScriptDoc.tokens`). */
  i: number;
  block: number;
  kind: 'word' | 'heading' | 'cue';
  text: string;
}

export interface Marker {
  block: number;
  token: number;
  level: 1 | 2 | 3;
  title: string;
}

export interface Cue {
  block: number;
  token: number;
  seconds?: number;
}

export interface ScriptDoc {
  blocks: Block[];
  tokens: Token[];
  /** Direction of the script as a whole (majority of words), used for the stage. */
  dominantDir: Dir;
  markers: Marker[];
  cues: Cue[];
  stats: {
    /** Words in paragraphs (the text that is read aloud). */
    words: number;
    /** Words in headings (spoken only when the "headings are read aloud" option is on). */
    headingWords: number;
    /** Visible characters, excluding markup. */
    chars: number;
  };
}

export function spokenWords(doc: ScriptDoc, headingsSpoken: boolean): number {
  return doc.stats.words + (headingsSpoken ? doc.stats.headingWords : 0);
}
