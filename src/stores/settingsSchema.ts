import { z } from 'zod';

const hexColor = z.string().regex(/^#[0-9a-f]{6}$/i);

export const FontRefSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('catalog'), id: z.string().min(1).max(100) }),
  z.object({ kind: z.literal('custom'), id: z.string().min(1).max(100) }),
  z.object({ kind: z.literal('system'), family: z.string().min(1).max(200) }),
  z.object({ kind: z.literal('local'), family: z.string().min(1).max(200) }),
]);

export const HUD_ITEMS = ['elapsed', 'remaining', 'clock', 'wpm', 'progress', 'marker'] as const;

export const AppearanceSchema = z.object({
  font: FontRefSchema,
  /** Optional Latin-only font listed first so Arabic glyphs fall through to `font`. */
  latinFont: FontRefSchema.nullable(),
  /** Font size in px at the 1280px reference stage width (see `scaleWithWidth`). */
  size: z.number().min(12).max(400),
  scaleWithWidth: z.boolean(),
  weight: z.number().int().min(100).max(1000),
  lineHeight: z.number().min(0.8).max(4),
  lineHeightFromFont: z.boolean(),
  /** em */
  wordSpacing: z.number().min(-0.2).max(2),
  /** em — applied to left-to-right lines only; it breaks Arabic joining. */
  letterSpacing: z.number().min(-0.1).max(1),
  /** Horizontal padding on each side, in % of the stage width. */
  marginPct: z.number().min(0).max(40),
  align: z.enum(['start', 'center', 'end', 'justify']),
  colors: z.object({
    fg: hexColor,
    bg: hexColor,
    mark: hexColor,
    note: hexColor,
    cue: hexColor,
    guide: hexColor,
    em: hexColor,
  }),
  hideTashkeel: z.boolean(),
  digits: z.enum(['asTyped', 'arab', 'latn']),
  showNotes: z.boolean(),
  guide: z.object({
    style: z.enum(['none', 'line', 'band', 'arrows', 'band+arrows']),
    positionPct: z.number().min(5).max(80),
    dim: z.number().min(0).max(0.9),
    bothSides: z.boolean(),
  }),
  fadeEdges: z.boolean(),
  hud: z.object({
    visible: z.boolean(),
    mirrorWithStage: z.boolean(),
    items: z.array(z.enum(HUD_ITEMS)).max(HUD_ITEMS.length),
  }),
});

export const ViewSchema = z.object({
  mirrorH: z.boolean(),
  mirrorV: z.boolean(),
});

export const BehaviorSchema = z.object({
  wpm: z.number().min(20).max(400),
  wpmStep: z.number().int().min(1).max(50),
  rampMs: z.number().min(0).max(5000),
  countdownSec: z.number().int().min(0).max(30),
  endBehavior: z.enum(['stop', 'loop', 'scrollOut']),
  autoPauseOnCues: z.boolean(),
  pauseAtMarkers: z.boolean(),
  headingsSpoken: z.boolean(),
  resumeLastPosition: z.boolean(),
  targetDurationSec: z.number().min(10).max(36_000).nullable(),
  wheelWhilePlaying: z.enum(['scroll', 'speed']),
  hideCursor: z.boolean(),
  keepAwake: z.boolean(),
});

export const KeyBindingSchema = z.object({
  code: z.string().min(1).max(40),
  ctrl: z.boolean().optional(),
  alt: z.boolean().optional(),
  shift: z.boolean().optional(),
  meta: z.boolean().optional(),
});

export const KeymapSchema = z.object({
  preset: z.enum(['keyboard', 'clicker', 'clickerSpeed', 'pedal']),
  overrides: z.record(z.string(), z.array(KeyBindingSchema).max(8)),
});

export const VoiceSchema = z.object({
  /** vad: scroll at the set speed while the talent speaks; follow: speech recognition tracks the words. */
  mode: z.enum(['vad', 'follow']),
  lang: z.string().min(2).max(20),
  vadSensitivityDb: z.number().min(4).max(30),
  lookAheadLines: z.number().min(0).max(3),
});

const IceServerSchema = z.object({
  urls: z.union([z.string(), z.array(z.string())]),
  username: z.string().optional(),
  credential: z.string().optional(),
});

export const RemoteSchema = z.object({
  /** Base URL of the remote page encoded in the QR code; empty = this app's own URL. */
  remoteBaseUrl: z.string().max(500),
  peerHost: z.string().max(253),
  peerPort: z.number().int().min(1).max(65_535).nullable(),
  peerPath: z.string().max(200),
  secure: z.boolean(),
  iceServers: z.array(IceServerSchema).max(10).nullable(),
  allowSettingChanges: z.boolean(),
  mediaKeys: z.boolean(),
});

export const CameraSchema = z.object({
  layout: z.enum(['off', 'background', 'pip']),
  deviceId: z.string().max(500).nullable(),
  mirrorPreview: z.boolean(),
  format: z.enum(['auto', 'mp4', 'webm']),
  videoBitsPerSecond: z.number().int().min(250_000).max(50_000_000),
  recordWithPlay: z.boolean(),
});

export const PresetSchema = z.object({
  id: z.string().min(1).max(40),
  name: z.string().min(1).max(80),
  appearance: AppearanceSchema,
  view: ViewSchema,
});

export const UiSchema = z.object({
  lang: z.enum(['ar', 'en']),
  digits: z.enum(['latn', 'arab']),
  theme: z.enum(['system', 'dark', 'light']),
});

export const SettingsSchema = z.object({
  version: z.literal(1),
  ui: UiSchema,
  appearance: AppearanceSchema,
  view: ViewSchema,
  display: ViewSchema,
  behavior: BehaviorSchema,
  keymap: KeymapSchema,
  voice: VoiceSchema,
  remote: RemoteSchema,
  camera: CameraSchema,
  presets: z.array(PresetSchema).max(50),
});

export type FontRef = z.infer<typeof FontRefSchema>;
export type Appearance = z.infer<typeof AppearanceSchema>;
export type ViewSettings = z.infer<typeof ViewSchema>;
export type Behavior = z.infer<typeof BehaviorSchema>;
export type KeyBinding = z.infer<typeof KeyBindingSchema>;
export type KeymapSettings = z.infer<typeof KeymapSchema>;
export type VoiceSettings = z.infer<typeof VoiceSchema>;
export type RemoteSettings = z.infer<typeof RemoteSchema>;
export type CameraSettings = z.infer<typeof CameraSchema>;
export type AppearancePreset = z.infer<typeof PresetSchema>;
export type UiSettings = z.infer<typeof UiSchema>;
export type Settings = z.infer<typeof SettingsSchema>;
export type HudItem = (typeof HUD_ITEMS)[number];

export function detectDefaultLang(): UiSettings['lang'] {
  const nav = typeof navigator === 'undefined' ? undefined : navigator;
  const first = nav?.languages?.[0] ?? nav?.language ?? 'en';
  return /^ar\b/i.test(first) ? 'ar' : 'en';
}

export const DEFAULT_APPEARANCE: Appearance = {
  font: { kind: 'catalog', id: 'cairo' },
  latinFont: null,
  size: 64,
  scaleWithWidth: true,
  weight: 600,
  lineHeight: 1.6,
  lineHeightFromFont: true,
  wordSpacing: 0,
  letterSpacing: 0,
  marginPct: 8,
  align: 'start',
  colors: {
    fg: '#ffffff',
    bg: '#000000',
    mark: '#ffd60a',
    note: '#8a93a6',
    cue: '#ff6b6b',
    guide: '#ffd60a',
    em: '#7cc4ff',
  },
  hideTashkeel: false,
  digits: 'asTyped',
  showNotes: true,
  guide: { style: 'band+arrows', positionPct: 33, dim: 0.35, bothSides: false },
  fadeEdges: true,
  hud: { visible: true, mirrorWithStage: true, items: ['elapsed', 'remaining', 'wpm', 'progress', 'marker'] },
};

export function createDefaultSettings(lang: UiSettings['lang'] = detectDefaultLang()): Settings {
  return {
    version: 1,
    ui: { lang, digits: 'latn', theme: 'system' },
    appearance: structuredClone(DEFAULT_APPEARANCE),
    view: { mirrorH: false, mirrorV: false },
    display: { mirrorH: false, mirrorV: false },
    behavior: {
      wpm: 120,
      wpmStep: 5,
      rampMs: 600,
      countdownSec: 3,
      endBehavior: 'stop',
      autoPauseOnCues: true,
      pauseAtMarkers: false,
      headingsSpoken: false,
      resumeLastPosition: true,
      targetDurationSec: null,
      wheelWhilePlaying: 'scroll',
      hideCursor: true,
      keepAwake: true,
    },
    keymap: { preset: 'keyboard', overrides: {} },
    voice: { mode: 'vad', lang: 'ar-SA', vadSensitivityDb: 12, lookAheadLines: 0.5 },
    remote: {
      remoteBaseUrl: '',
      peerHost: '',
      peerPort: null,
      peerPath: '/',
      secure: true,
      iceServers: null,
      allowSettingChanges: true,
      mediaKeys: false,
    },
    camera: {
      layout: 'off',
      deviceId: null,
      mirrorPreview: true,
      format: 'auto',
      videoBitsPerSecond: 5_000_000,
      recordWithPlay: true,
    },
    presets: [],
  };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Validates `value` against `schema`, keeping every valid field and replacing only the invalid ones
 * with the matching field of `fallback` (recursing into nested objects). Corrupt or outdated storage
 * therefore never resets more settings than necessary.
 */
export function sanitize<T>(schema: z.ZodType<T>, value: unknown, fallback: T): T {
  const parsed = schema.safeParse(value);
  if (parsed.success) return parsed.data;
  if (schema instanceof z.ZodObject && isPlainObject(value) && isPlainObject(fallback)) {
    const shape = schema.shape as Record<string, z.ZodType>;
    const out: Record<string, unknown> = {};
    for (const [key, fieldSchema] of Object.entries(shape)) {
      out[key] = sanitize(fieldSchema, value[key], fallback[key]);
    }
    return out as T;
  }
  return fallback;
}

export function sanitizeSettings(value: unknown, fallback: Settings = createDefaultSettings()): Settings {
  return sanitize(SettingsSchema, value, fallback);
}
