import { getDatabase } from './db';
import type { Script } from './types';

export interface ScriptsRepo {
  /** False when IndexedDB is unavailable and data only lives in memory. */
  readonly persistent: boolean;
  list(): Promise<Script[]>;
  get(id: string): Promise<Script | undefined>;
  put(script: Script): Promise<void>;
  delete(id: string): Promise<void>;
  getMeta<T>(key: string): Promise<T | undefined>;
  setMeta(key: string, value: unknown): Promise<void>;
}

const byUpdatedDesc = (a: Script, b: Script) => b.updatedAt - a.updatedAt;

export function createIdbScriptsRepo(): ScriptsRepo {
  return {
    persistent: true,
    async list() {
      const db = await getDatabase();
      return (await db.getAll('scripts')).sort(byUpdatedDesc);
    },
    async get(id) {
      return (await getDatabase()).get('scripts', id);
    },
    async put(script) {
      await (await getDatabase()).put('scripts', script);
    },
    async delete(id) {
      await (await getDatabase()).delete('scripts', id);
    },
    async getMeta<T>(key: string) {
      return (await (await getDatabase()).get('kv', key)) as T | undefined;
    },
    async setMeta(key, value) {
      await (await getDatabase()).put('kv', value, key);
    },
  };
}

export function createMemoryScriptsRepo(): ScriptsRepo {
  const scripts = new Map<string, Script>();
  const meta = new Map<string, unknown>();
  return {
    persistent: false,
    async list() {
      return [...scripts.values()].map((s) => structuredClone(s)).sort(byUpdatedDesc);
    },
    async get(id) {
      const script = scripts.get(id);
      return script && structuredClone(script);
    },
    async put(script) {
      scripts.set(script.id, structuredClone(script));
    },
    async delete(id) {
      scripts.delete(id);
    },
    async getMeta<T>(key: string) {
      return meta.get(key) as T | undefined;
    },
    async setMeta(key, value) {
      meta.set(key, value);
    },
  };
}

/** Opens IndexedDB, falling back to memory (private browsing, disabled storage, quota errors). */
export async function openScriptsRepo(): Promise<ScriptsRepo> {
  try {
    const repo = createIdbScriptsRepo();
    await repo.list();
    return repo;
  } catch (error) {
    console.warn('IndexedDB unavailable, scripts will not be saved.', error);
    return createMemoryScriptsRepo();
  }
}
