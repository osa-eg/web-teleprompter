import { getDatabase } from './db';
import type { CustomFontRecord } from './types';

export interface FontsRepo {
  list(): Promise<CustomFontRecord[]>;
  get(id: string): Promise<CustomFontRecord | undefined>;
  put(record: CustomFontRecord): Promise<void>;
  delete(id: string): Promise<void>;
}

export function createIdbFontsRepo(): FontsRepo {
  return {
    async list() {
      return (await (await getDatabase()).getAll('fonts')).sort((a, b) => a.addedAt - b.addedAt);
    },
    async get(id) {
      return (await getDatabase()).get('fonts', id);
    },
    async put(record) {
      await (await getDatabase()).put('fonts', record);
    },
    async delete(id) {
      await (await getDatabase()).delete('fonts', id);
    },
  };
}

export function createMemoryFontsRepo(): FontsRepo {
  const records = new Map<string, CustomFontRecord>();
  return {
    async list() {
      return [...records.values()].sort((a, b) => a.addedAt - b.addedAt);
    },
    async get(id) {
      return records.get(id);
    },
    async put(record) {
      records.set(record.id, record);
    },
    async delete(id) {
      records.delete(id);
    },
  };
}

export async function openFontsRepo(): Promise<FontsRepo> {
  try {
    const repo = createIdbFontsRepo();
    await repo.list();
    return repo;
  } catch {
    return createMemoryFontsRepo();
  }
}
