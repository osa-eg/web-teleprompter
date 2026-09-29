import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { createDefaultSettings, sanitizeSettings, type Settings } from './settingsSchema';

export * from './settingsSchema';

/** All storage keys are prefixed: every github.io project site shares one origin. */
export const SETTINGS_KEY = 'tp:settings';
export const SETTINGS_VERSION = 1;

type ObjectSection = {
  [K in keyof Settings]: Settings[K] extends unknown[] ? never : Settings[K] extends object ? K : never;
}[keyof Settings];

export interface SettingsState {
  settings: Settings;
  /** Shallow-merges `value` into one settings section. */
  patch: <K extends ObjectSection>(section: K, value: Partial<Settings[K]>) => void;
  update: (fn: (settings: Settings) => Settings) => void;
  resetSection: (section: Exclude<keyof Settings, 'version'>) => void;
  resetAll: () => void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      settings: createDefaultSettings(),
      patch: (section, value) =>
        set((state) => ({
          settings: { ...state.settings, [section]: { ...state.settings[section], ...value } },
        })),
      update: (fn) => set((state) => ({ settings: fn(state.settings) })),
      resetSection: (section) =>
        set((state) => ({
          settings: {
            ...state.settings,
            [section]: createDefaultSettings(state.settings.ui.lang)[section],
          },
        })),
      resetAll: () => set((state) => ({ settings: createDefaultSettings(state.settings.ui.lang) })),
    }),
    {
      name: SETTINGS_KEY,
      version: SETTINGS_VERSION,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ settings: state.settings }),
      // Future schema versions transform old data here; sanitizing in `merge` handles the rest.
      migrate: (persisted) => persisted as { settings: Settings },
      merge: (persisted, current) => ({
        ...current,
        settings: sanitizeSettings(
          (persisted as { settings?: unknown } | undefined)?.settings,
          current.settings,
        ),
      }),
    },
  ),
);

/** Keeps every open window (editor, prompter, display) in sync when another one saves settings. */
export function initSettingsSync(): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key === SETTINGS_KEY) void useSettings.persist.rehydrate();
  };
  window.addEventListener('storage', onStorage);
  return () => window.removeEventListener('storage', onStorage);
}
