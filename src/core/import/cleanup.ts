import { stripTashkeel } from '../script/arabic';

const ch = (codePoint: number) => String.fromCodePoint(codePoint);
const span = (from: number, to: number) => `${ch(from)}-${ch(to)}`;

/**
 * Arabic presentation forms (often produced when copying from PDFs). Word ligatures such as
 * U+FDFA (ﷺ) in U+FDF0–U+FDFF are deliberately kept.
 */
const PRESENTATION_FORMS = new RegExp(`[${span(0xfb50, 0xfdcf)}${span(0xfe70, 0xfefc)}]`, 'g');

/** LRM, RLM, ALM, embeddings/overrides (U+202A–U+202E) and isolates (U+2066–U+2069). */
const DIRECTION_MARKS = new RegExp(
  `[${ch(0x200e)}${ch(0x200f)}${ch(0x061c)}${span(0x202a, 0x202e)}${span(0x2066, 0x2069)}]`,
  'g',
);

/** Converts presentation-form glyphs back to ordinary Arabic letters (ﻣﺮﺣﺒﺎ → مرحبا). */
export function convertPresentationForms(text: string): string {
  return text.replace(PRESENTATION_FORMS, (form) => form.normalize('NFKC'));
}

export function removeDirectionMarks(text: string): string {
  return text.replace(DIRECTION_MARKS, '');
}

export function removeTashkeel(text: string): string {
  return stripTashkeel(text);
}

/** Collapses repeated spaces, converts no-break spaces, trims line ends and extra blank lines. */
export function normalizeSpaces(text: string): string {
  return text
    .replace(new RegExp(`[${ch(0xa0)}${ch(0x202f)}${ch(0x2007)}]`, 'g'), ' ')
    .replace(/[ \t]+/g, ' ')
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const SENTENCE_END = /[.!?؟…:؛»"'”’)\]]$/u;
const STRUCTURAL = /^\s*(#{1,3}\s|\[|•|-\s|\*\s|\d+[.)]\s)/;

/**
 * Joins lines that were wrapped by hand (e.g. pasted from a PDF or an email): inside a paragraph, a
 * line that does not end a sentence is merged with the next one.
 */
export function joinWrappedLines(text: string): string {
  const lines = text.split('\n');
  const out: string[] = [];
  for (const line of lines) {
    const previous = out[out.length - 1];
    const canJoin =
      previous !== undefined &&
      previous.trim() !== '' &&
      line.trim() !== '' &&
      !SENTENCE_END.test(previous.trim()) &&
      !STRUCTURAL.test(previous) &&
      !STRUCTURAL.test(line);
    if (canJoin) out[out.length - 1] = `${previous.trimEnd()} ${line.trimStart()}`;
    else out.push(line);
  }
  return out.join('\n');
}

export type CleanupTool = 'presentationForms' | 'joinLines' | 'directionMarks' | 'tashkeel' | 'spaces';

export const CLEANUP_TOOLS: Record<CleanupTool, (text: string) => string> = {
  presentationForms: convertPresentationForms,
  joinLines: joinWrappedLines,
  directionMarks: removeDirectionMarks,
  tashkeel: removeTashkeel,
  spaces: normalizeSpaces,
};
