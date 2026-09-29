import { beforeEach, describe, expect, it } from 'vitest';
import { cycleHeading, insertToken, toggleWrap, transformLine } from './textareaCommands';

let textarea: HTMLTextAreaElement;

beforeEach(() => {
  document.body.innerHTML = '<textarea></textarea>';
  textarea = document.querySelector('textarea')!;
});

function set(value: string, start: number, end = start) {
  textarea.value = value;
  textarea.setSelectionRange(start, end);
}

describe('textarea commands', () => {
  it('wraps and unwraps the selection', () => {
    set('مرحبا بكم', 0, 5);
    toggleWrap(textarea, '**', '**', 'نص');
    expect(textarea.value).toBe('**مرحبا** بكم');
    expect(textarea.value.slice(textarea.selectionStart, textarea.selectionEnd)).toBe('مرحبا');
    toggleWrap(textarea, '**', '**', 'نص');
    expect(textarea.value).toBe('مرحبا بكم');
  });

  it('inserts a placeholder when nothing is selected', () => {
    set('a  b', 2);
    toggleWrap(textarea, '==', '==', 'text');
    expect(textarea.value).toBe('a ==text== b');
    expect(textarea.value.slice(textarea.selectionStart, textarea.selectionEnd)).toBe('text');
  });

  it('transforms the current line only', () => {
    set('first\nsecond\nthird', 8);
    transformLine(textarea, (line) => line.toUpperCase());
    expect(textarea.value).toBe('first\nSECOND\nthird');
  });

  it('cycles heading levels', () => {
    expect(cycleHeading('Intro')).toBe('# Intro');
    expect(cycleHeading('# Intro')).toBe('## Intro');
    expect(cycleHeading('### Intro')).toBe('Intro');
  });

  it('pads inserted tokens with spaces', () => {
    set('onetwo', 3);
    insertToken(textarea, '[pause]');
    expect(textarea.value).toBe('one [pause] two');
  });
});
