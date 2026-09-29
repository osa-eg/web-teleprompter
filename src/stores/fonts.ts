import { create } from 'zustand';
import {
  ARABIC_PROBE,
  detectFontFormat,
  familyCovers,
  familyNameFromFile,
  guessFace,
  MAX_FONT_BYTES,
  newCustomFamily,
  registerCustomFont,
  unregisterCustomFont,
  validateFontData,
} from '@/features/fonts/customFonts';
import { openFontsRepo, type FontsRepo } from '@/storage/fontsRepo';
import { randomId } from '@/storage/ids';
import type { CustomFontFace, CustomFontRecord } from '@/storage/types';

/** Custom font metadata without the (large) binary data. */
export interface CustomFontInfo {
  id: string;
  name: string;
  family: string;
  hasArabic: boolean;
  addedAt: number;
  weights: number[];
  bytes: number;
}

export type FontUploadError = { file: string; reason: 'tooLarge' | 'unsupported' | 'invalid' };

interface FontsState {
  status: 'idle' | 'loading' | 'ready';
  custom: CustomFontInfo[];
  init(): Promise<void>;
  /** Stores uploaded files as one family (files are grouped by their family name). */
  upload(files: File[]): Promise<{ added: CustomFontInfo[]; errors: FontUploadError[] }>;
  rename(id: string, name: string): Promise<void>;
  remove(id: string): Promise<void>;
  /** Registers a stored font with the document so it can render. */
  ensureRegistered(id: string): Promise<boolean>;
}

let repo: FontsRepo | null = null;
let initPromise: Promise<void> | null = null;

function toInfo(record: CustomFontRecord): CustomFontInfo {
  return {
    id: record.id,
    name: record.name,
    family: record.family,
    hasArabic: record.hasArabic,
    addedAt: record.addedAt,
    weights: [...new Set(record.faces.map((f) => f.weight))].sort((a, b) => a - b),
    bytes: record.faces.reduce((sum, f) => sum + f.data.byteLength, 0),
  };
}

export const useFonts = create<FontsState>()((set, get) => ({
  status: 'idle',
  custom: [],

  init() {
    initPromise ??= (async () => {
      set({ status: 'loading' });
      repo = await openFontsRepo();
      const records = await repo.list();
      set({ status: 'ready', custom: records.map(toInfo) });
    })();
    return initPromise;
  },

  async upload(files) {
    await get().init();
    const errors: FontUploadError[] = [];
    const groups = new Map<string, { file: File; face: CustomFontFace }[]>();

    for (const file of files) {
      if (file.size > MAX_FONT_BYTES) {
        errors.push({ file: file.name, reason: 'tooLarge' });
        continue;
      }
      // Stored as ArrayBuffer: Blob storage in IndexedDB is unreliable in older Safari.
      const data = await file.arrayBuffer();
      const format = detectFontFormat(data, file.name);
      if (!format) {
        errors.push({ file: file.name, reason: 'unsupported' });
        continue;
      }
      if (!(await validateFontData(data))) {
        errors.push({ file: file.name, reason: 'invalid' });
        continue;
      }
      const { weight, style } = guessFace(file.name);
      const name = familyNameFromFile(file.name);
      const group = groups.get(name) ?? [];
      group.push({ file, face: { weight, style, format, fileName: file.name, data } });
      groups.set(name, group);
    }

    const added: CustomFontInfo[] = [];
    for (const [name, group] of groups) {
      const id = randomId(10);
      const record: CustomFontRecord = {
        id,
        name,
        family: newCustomFamily(id),
        hasArabic: false,
        addedAt: Date.now(),
        faces: group.map((g) => g.face),
      };
      await registerCustomFont(record);
      record.hasArabic = familyCovers(record.family, ARABIC_PROBE);
      await repo?.put(record);
      added.push(toInfo(record));
    }
    if (added.length) set((state) => ({ custom: [...state.custom, ...added] }));
    return { added, errors };
  },

  async rename(id, name) {
    const record = await repo?.get(id);
    if (!record || !name.trim()) return;
    record.name = name.trim();
    await repo?.put(record);
    set((state) => ({ custom: state.custom.map((f) => (f.id === id ? { ...f, name: record.name } : f)) }));
  },

  async remove(id) {
    unregisterCustomFont(id);
    await repo?.delete(id);
    set((state) => ({ custom: state.custom.filter((f) => f.id !== id) }));
  },

  async ensureRegistered(id) {
    await get().init();
    const record = await repo?.get(id);
    if (!record) return false;
    try {
      await registerCustomFont(record);
      return true;
    } catch {
      return false;
    }
  },
}));

/** Test helper. */
export function resetFontsForTests(): void {
  repo = null;
  initPromise = null;
  useFonts.setState({ status: 'idle', custom: [] });
}
