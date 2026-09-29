/**
 * Editing helpers for the script textarea. Edits go through `execCommand('insertText')` so they join
 * the browser's native undo history (Ctrl/⌘+Z); `setRangeText` is the fallback.
 */

export function insertText(textarea: HTMLTextAreaElement, text: string): void {
  textarea.focus();
  const inserted =
    typeof document.execCommand === 'function' && document.execCommand('insertText', false, text);
  if (!inserted) {
    textarea.setRangeText(text, textarea.selectionStart, textarea.selectionEnd, 'end');
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
  }
}

/** Wraps the selection in `before`/`after`, or unwraps it when it is already wrapped. */
export function toggleWrap(
  textarea: HTMLTextAreaElement,
  before: string,
  after: string,
  placeholder: string,
): void {
  const { selectionStart: start, selectionEnd: end, value } = textarea;
  const wrapped =
    start >= before.length &&
    value.slice(start - before.length, start) === before &&
    value.slice(end, end + after.length) === after;

  if (wrapped) {
    const inner = value.slice(start, end);
    textarea.setSelectionRange(start - before.length, end + after.length);
    insertText(textarea, inner);
    textarea.setSelectionRange(start - before.length, start - before.length + inner.length);
    return;
  }

  const inner = value.slice(start, end) || placeholder;
  insertText(textarea, before + inner + after);
  textarea.setSelectionRange(start + before.length, start + before.length + inner.length);
}

/** Replaces the line containing the caret with `transform(line)`, keeping the caret on that line. */
export function transformLine(textarea: HTMLTextAreaElement, transform: (line: string) => string): void {
  const { selectionStart, value } = textarea;
  const lineStart = value.lastIndexOf('\n', selectionStart - 1) + 1;
  const nextBreak = value.indexOf('\n', selectionStart);
  const lineEnd = nextBreak === -1 ? value.length : nextBreak;
  const line = value.slice(lineStart, lineEnd);
  const next = transform(line);
  if (next === line) return;
  textarea.setSelectionRange(lineStart, lineEnd);
  insertText(textarea, next);
  const caret = Math.min(
    lineStart + next.length,
    Math.max(lineStart, selectionStart + (next.length - line.length)),
  );
  textarea.setSelectionRange(caret, caret);
}

const HEADING_PREFIX = /^(\s{0,3})(#{1,3})\s+/;

/** Cycles a line through: text → # heading → ## heading → ### heading → text. */
export function cycleHeading(line: string): string {
  const match = HEADING_PREFIX.exec(line);
  if (!match) return `# ${line.trimStart()}`;
  const level = match[2]!.length;
  const rest = line.slice(match[0].length);
  return level >= 3 ? rest : `${'#'.repeat(level + 1)} ${rest}`;
}

/** Inserts a token at the caret with spaces around it when needed. */
export function insertToken(textarea: HTMLTextAreaElement, token: string): void {
  const { selectionStart, selectionEnd, value } = textarea;
  const before = value[selectionStart - 1];
  const after = value[selectionEnd];
  const lead = before && !/\s/.test(before) ? ' ' : '';
  const trail = after && !/\s/.test(after) ? ' ' : '';
  insertText(textarea, `${lead}${token}${trail}`);
}
