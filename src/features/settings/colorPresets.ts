import type { MessageKey } from '@/i18n';
import type { Appearance } from '@/stores/settingsSchema';

export interface ColorPreset {
  id: string;
  label: MessageKey;
  colors: Appearance['colors'];
}

export const COLOR_PRESETS: ColorPreset[] = [
  {
    id: 'classic',
    label: 'colors.classic',
    colors: {
      fg: '#ffffff',
      bg: '#000000',
      mark: '#ffd60a',
      note: '#8a93a6',
      cue: '#ff6b6b',
      guide: '#ffd60a',
      em: '#7cc4ff',
    },
  },
  {
    id: 'amber',
    label: 'colors.amber',
    colors: {
      fg: '#ffd60a',
      bg: '#000000',
      mark: '#ffffff',
      note: '#a08c4a',
      cue: '#ff8a65',
      guide: '#ffffff',
      em: '#ffffff',
    },
  },
  {
    id: 'paper',
    label: 'colors.paper',
    colors: {
      fg: '#111111',
      bg: '#fdfcf8',
      mark: '#ffe066',
      note: '#6b7280',
      cue: '#c62828',
      guide: '#1565c0',
      em: '#1565c0',
    },
  },
  {
    id: 'green',
    label: 'colors.green',
    colors: {
      fg: '#39ff88',
      bg: '#000000',
      mark: '#ffffff',
      note: '#3f8f5f',
      cue: '#ffd60a',
      guide: '#ffffff',
      em: '#ffffff',
    },
  },
  {
    id: 'blue',
    label: 'colors.blue',
    colors: {
      fg: '#ffffff',
      bg: '#0b1d3a',
      mark: '#ffd60a',
      note: '#8fa3c7',
      cue: '#ff8a80',
      guide: '#4fc3f7',
      em: '#4fc3f7',
    },
  },
];
