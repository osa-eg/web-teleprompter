import { describe, expect, it } from 'vitest';
import { actionCommand } from './actions';
import { bindingFromEvent, findConflicts, formatBinding, matchAction, type KeyLike } from './match';
import { KEYMAP_PRESETS, resolveKeymap } from './presets';

const key = (code: string, mods: Partial<KeyLike> = {}): KeyLike => ({
  code,
  ctrlKey: false,
  altKey: false,
  shiftKey: false,
  metaKey: false,
  ...mods,
});

describe('keymap', () => {
  const keyboard = KEYMAP_PRESETS.keyboard;

  it('matches physical key codes with exact modifiers', () => {
    expect(matchAction(keyboard, key('Space'))).toBe('togglePlay');
    expect(matchAction(keyboard, key('KeyM'))).toBe('mirrorH');
    expect(matchAction(keyboard, key('KeyM', { shiftKey: true }))).toBe('mirrorV');
    expect(matchAction(keyboard, key('KeyM', { ctrlKey: true }))).toBeNull();
    expect(matchAction(keyboard, key('Digit3'))).toBe('marker3');
  });

  it('maps clicker keys to stepping in the clicker preset', () => {
    const clicker = KEYMAP_PRESETS.clicker;
    expect(matchAction(clicker, key('PageDown'))).toBe('nextBlock');
    expect(matchAction(clicker, key('ArrowLeft'))).toBe('prevBlock');
    expect(matchAction(clicker, key('F5'))).toBe('togglePlay');
    expect(matchAction(clicker, key('F5', { shiftKey: true }))).toBe('togglePlay');
    expect(matchAction(KEYMAP_PRESETS.clickerSpeed, key('PageDown'))).toBe('faster');
    expect(matchAction(KEYMAP_PRESETS.pedal, key('KeyA'))).toBe('slower');
  });

  it('applies user overrides on top of a preset', () => {
    const map = resolveKeymap('keyboard', { togglePlay: [{ code: 'Enter' }] });
    expect(matchAction(map, key('Enter'))).toBe('togglePlay');
    expect(matchAction(map, key('Space'))).toBeNull();
  });

  it('finds conflicting bindings', () => {
    expect(findConflicts(keyboard, { code: 'KeyM' })).toEqual(['mirrorH']);
    expect(findConflicts(keyboard, { code: 'KeyM' }, 'mirrorH')).toEqual([]);
  });

  it('builds and formats bindings', () => {
    const binding = bindingFromEvent(key('KeyM', { shiftKey: true }));
    expect(binding).toEqual({ code: 'KeyM', shift: true });
    expect(formatBinding(binding)).toBe('Shift+M');
    expect(formatBinding({ code: 'ArrowUp' })).toBe('↑');
    expect(formatBinding({ code: 'Digit4' })).toBe('4');
  });

  it('turns actions into commands', () => {
    expect(actionCommand('faster')).toEqual({ type: 'nudgeWpm', steps: 1 });
    expect(actionCommand('marker4')).toEqual({ type: 'gotoMarker', index: 3 });
    expect(actionCommand('mirrorV')).toEqual({ type: 'toggleMirror', axis: 'v' });
  });
});
