import type { KeyBinding } from '@/stores/settingsSchema';
import { ACTION_IDS, type ActionId } from './actions';
import type { Keymap } from './presets';

export interface KeyLike {
  code: string;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  metaKey: boolean;
}

export function bindingMatches(binding: KeyBinding, event: KeyLike): boolean {
  return (
    binding.code === event.code &&
    !!binding.ctrl === event.ctrlKey &&
    !!binding.alt === event.altKey &&
    !!binding.shift === event.shiftKey &&
    !!binding.meta === event.metaKey
  );
}

/** Finds the action bound to a key event (exact modifiers), in a stable action order. */
export function matchAction(keymap: Keymap, event: KeyLike): ActionId | null {
  for (const action of ACTION_IDS) {
    if (keymap[action]?.some((binding) => bindingMatches(binding, event))) return action;
  }
  return null;
}

/** Key events typed into form fields must never trigger prompter shortcuts. */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (!target || typeof (target as Element).closest !== 'function') return false;
  const element = target as HTMLElement;
  if (element.isContentEditable) return true;
  const field = element.closest('input, textarea, select, [contenteditable="true"]');
  if (!field) return false;
  if (field instanceof HTMLInputElement) {
    return !['button', 'checkbox', 'radio', 'range', 'color', 'submit', 'reset'].includes(field.type);
  }
  return true;
}

/** Other actions that already use the same key combination. */
export function findConflicts(keymap: Keymap, binding: KeyBinding, except?: ActionId): ActionId[] {
  const probe: KeyLike = {
    code: binding.code,
    ctrlKey: !!binding.ctrl,
    altKey: !!binding.alt,
    shiftKey: !!binding.shift,
    metaKey: !!binding.meta,
  };
  return ACTION_IDS.filter(
    (action) => action !== except && keymap[action]?.some((b) => bindingMatches(b, probe)),
  );
}

export function bindingFromEvent(event: KeyLike): KeyBinding {
  const binding: KeyBinding = { code: event.code };
  if (event.ctrlKey) binding.ctrl = true;
  if (event.altKey) binding.alt = true;
  if (event.shiftKey) binding.shift = true;
  if (event.metaKey) binding.meta = true;
  return binding;
}

const CODE_LABELS: Record<string, string> = {
  Space: 'Space',
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
  PageUp: 'PgUp',
  PageDown: 'PgDn',
  Equal: '=',
  Minus: '-',
  Period: '.',
  Comma: ',',
  Slash: '/',
  BracketLeft: '[',
  BracketRight: ']',
  Escape: 'Esc',
  NumpadAdd: 'Num +',
  NumpadSubtract: 'Num −',
  MediaPlayPause: '⏯',
  MediaTrackNext: '⏭',
  MediaTrackPrevious: '⏮',
};

/** Human-readable label, e.g. "Shift+M". Optional layoutMap comes from navigator.keyboard. */
export function formatBinding(binding: KeyBinding, layoutMap?: Map<string, string>): string {
  const key =
    CODE_LABELS[binding.code] ??
    layoutMap?.get(binding.code)?.toUpperCase() ??
    binding.code
      .replace(/^Key/, '')
      .replace(/^Digit/, '')
      .replace(/^Numpad/, 'Num ');
  const parts: string[] = [];
  if (binding.ctrl) parts.push('Ctrl');
  if (binding.alt) parts.push('Alt');
  if (binding.shift) parts.push('Shift');
  if (binding.meta) parts.push('⌘');
  parts.push(key);
  return parts.join('+');
}
