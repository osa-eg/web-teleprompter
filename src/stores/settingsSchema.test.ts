import { describe, expect, it } from 'vitest';
import { createDefaultSettings, sanitizeSettings, SettingsSchema } from './settingsSchema';

describe('settings schema', () => {
  it('accepts the defaults', () => {
    expect(SettingsSchema.safeParse(createDefaultSettings('ar')).success).toBe(true);
    expect(SettingsSchema.safeParse(createDefaultSettings('en')).success).toBe(true);
  });

  it('falls back to defaults for garbage', () => {
    const defaults = createDefaultSettings('en');
    expect(sanitizeSettings(null, defaults)).toEqual(defaults);
    expect(sanitizeSettings('not json', defaults)).toEqual(defaults);
    expect(sanitizeSettings(42, defaults)).toEqual(defaults);
  });

  it('keeps valid fields and repairs only the invalid ones', () => {
    const defaults = createDefaultSettings('en');
    const stored = structuredClone(defaults) as unknown as Record<string, Record<string, unknown>>;
    stored.ui!.lang = 'ar';
    stored.appearance!.size = 9999; // out of range
    stored.appearance!.align = 'end';
    stored.behavior!.wpm = 'fast'; // wrong type
    delete stored.voice; // missing section

    const result = sanitizeSettings(stored, defaults);
    expect(result.ui.lang).toBe('ar');
    expect(result.appearance.align).toBe('end');
    expect(result.appearance.size).toBe(defaults.appearance.size);
    expect(result.behavior.wpm).toBe(defaults.behavior.wpm);
    expect(result.voice).toEqual(defaults.voice);
    expect(SettingsSchema.safeParse(result).success).toBe(true);
  });

  it('repairs nested objects field by field', () => {
    const defaults = createDefaultSettings('en');
    const stored = structuredClone(defaults);
    (stored.appearance.colors as Record<string, string>).fg = 'red';
    stored.appearance.colors.bg = '#123456';
    const result = sanitizeSettings(stored, defaults);
    expect(result.appearance.colors.fg).toBe(defaults.appearance.colors.fg);
    expect(result.appearance.colors.bg).toBe('#123456');
  });
});
