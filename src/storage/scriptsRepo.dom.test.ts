import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetDatabaseConnection } from './db';
import { createIdbScriptsRepo, createMemoryScriptsRepo, openScriptsRepo } from './scriptsRepo';
import type { Script } from './types';

const script = (id: string, updatedAt: number): Script => ({
  id,
  title: `Script ${id}`,
  body: 'مرحبا',
  direction: 'auto',
  createdAt: updatedAt,
  updatedAt,
});

beforeEach(() => {
  resetDatabaseConnection();
  globalThis.indexedDB = new IDBFactory();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe.each([
  ['indexeddb', createIdbScriptsRepo],
  ['memory', createMemoryScriptsRepo],
])('%s scripts repo', (_name, createRepo) => {
  it('stores, lists newest first, updates and deletes', async () => {
    const repo = createRepo();
    await repo.put(script('a', 1));
    await repo.put(script('b', 3));
    await repo.put(script('c', 2));
    expect((await repo.list()).map((s) => s.id)).toEqual(['b', 'c', 'a']);

    await repo.put({ ...script('a', 4), title: 'Renamed' });
    expect((await repo.get('a'))?.title).toBe('Renamed');
    expect((await repo.list())[0]?.id).toBe('a');

    await repo.delete('b');
    expect(await repo.get('b')).toBeUndefined();
    expect(await repo.list()).toHaveLength(2);
  });

  it('stores metadata', async () => {
    const repo = createRepo();
    expect(await repo.getMeta('seeded')).toBeUndefined();
    await repo.setMeta('seeded', true);
    expect(await repo.getMeta('seeded')).toBe(true);
  });
});

describe('openScriptsRepo', () => {
  it('uses IndexedDB when available', async () => {
    const repo = await openScriptsRepo();
    expect(repo.persistent).toBe(true);
  });

  it('falls back to memory when IndexedDB cannot be opened', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(globalThis.indexedDB, 'open').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    const repo = await openScriptsRepo();
    expect(repo.persistent).toBe(false);
    await repo.put(script('x', 1));
    expect(await repo.get('x')).toBeDefined();
  });
});
