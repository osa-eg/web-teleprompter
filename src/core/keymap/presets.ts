import type { KeyBinding } from '@/stores/settingsSchema';
import type { ActionId } from './actions';

export type KeymapPreset = 'keyboard' | 'clicker' | 'clickerSpeed' | 'pedal';
export type Keymap = Partial<Record<ActionId, KeyBinding[]>>;

const k = (code: string, mods: Omit<KeyBinding, 'code'> = {}): KeyBinding => ({ code, ...mods });
const shift = (code: string) => k(code, { shift: true });

const markerKeys: Keymap = Object.fromEntries(
  Array.from({ length: 9 }, (_, i) => [`marker${i + 1}`, [k(`Digit${i + 1}`), k(`Numpad${i + 1}`)]]),
);

/**
 * Bindings match `KeyboardEvent.code` (physical keys), so they work with Arabic keyboard layouts and
 * with presentation clickers / foot pedals, which emulate keyboards.
 */
const KEYBOARD: Keymap = {
  togglePlay: [k('Space'), k('KeyK'), k('Period'), k('KeyB'), k('MediaPlayPause')],
  faster: [k('ArrowUp'), k('Equal'), k('NumpadAdd')],
  slower: [k('ArrowDown'), k('Minus'), k('NumpadSubtract')],
  lineForward: [k('ArrowRight')],
  lineBack: [k('ArrowLeft')],
  nextBlock: [k('PageDown'), k('MediaTrackNext')],
  prevBlock: [k('PageUp'), k('MediaTrackPrevious')],
  nextMarker: [k('KeyN'), shift('PageDown')],
  prevMarker: [k('KeyP'), shift('PageUp')],
  ...markerKeys,
  toStart: [k('Home')],
  toEnd: [k('End')],
  fontBigger: [k('BracketRight')],
  fontSmaller: [k('BracketLeft')],
  mirrorH: [k('KeyM')],
  mirrorV: [shift('KeyM')],
  fullscreen: [k('KeyF')],
  toggleHud: [k('KeyH')],
  toggleGuide: [k('KeyG')],
  reset: [k('KeyR')],
  toggleVoice: [k('KeyV')],
  toggleCamera: [k('KeyC')],
  toggleRecording: [shift('KeyR')],
  help: [shift('Slash')],
  exit: [k('Escape')],
};

/** Presentation clickers (Logitech R400/R500/Spotlight, Kensington, page turners): step through the script. */
const CLICKER: Keymap = {
  ...KEYBOARD,
  togglePlay: [k('Period'), k('KeyB'), k('F5'), shift('F5'), k('Space'), k('MediaPlayPause')],
  nextBlock: [k('PageDown'), k('ArrowRight'), k('ArrowDown'), k('MediaTrackNext')],
  prevBlock: [k('PageUp'), k('ArrowLeft'), k('ArrowUp'), k('MediaTrackPrevious')],
  faster: [k('Equal'), k('NumpadAdd')],
  slower: [k('Minus'), k('NumpadSubtract')],
  lineForward: [],
  lineBack: [],
};

/** Clickers used as a speed control. */
const CLICKER_SPEED: Keymap = {
  ...KEYBOARD,
  togglePlay: [k('Period'), k('KeyB'), k('F5'), shift('F5'), k('Space'), k('MediaPlayPause')],
  faster: [k('PageDown'), k('ArrowRight'), k('ArrowUp'), k('Equal'), k('NumpadAdd')],
  slower: [k('PageUp'), k('ArrowLeft'), k('ArrowDown'), k('Minus'), k('NumpadSubtract')],
  nextBlock: [k('MediaTrackNext')],
  prevBlock: [k('MediaTrackPrevious')],
  lineForward: [],
  lineBack: [],
};

/** USB foot pedals (factory keys A/B/C on PCsensor-style pedals, or page keys). */
const PEDAL: Keymap = {
  ...KEYBOARD,
  slower: [k('KeyA'), k('ArrowDown'), k('Minus')],
  togglePlay: [k('KeyB'), k('Space'), k('Period'), k('MediaPlayPause')],
  faster: [k('KeyC'), k('ArrowUp'), k('Equal')],
  nextBlock: [k('PageDown')],
  prevBlock: [k('PageUp')],
};

export const KEYMAP_PRESETS: Record<KeymapPreset, Keymap> = {
  keyboard: KEYBOARD,
  clicker: CLICKER,
  clickerSpeed: CLICKER_SPEED,
  pedal: PEDAL,
};

/** Effective keymap: the preset with the user's per-action overrides on top. */
export function resolveKeymap(
  preset: KeymapPreset,
  overrides: Partial<Record<string, KeyBinding[]>>,
): Keymap {
  return { ...KEYMAP_PRESETS[preset], ...(overrides as Keymap) };
}
