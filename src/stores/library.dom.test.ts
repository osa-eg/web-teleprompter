import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetDatabaseConnection } from '@/storage/db';
import { resetLibraryForTests, useLibrary } from './library';

beforeEach(() => {
  resetDatabaseConnection();
  globalThis.indexedDB = new IDBFactory();
  localStorage.clear();
  resetLibraryForTests();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('library store', () => {
  it('seeds sample scripts once', async () => {
    await useLibrary.getState().init();
    expect(useLibrary.getState().scripts).toHaveLength(3);
    for (const script of [...useLibrary.getState().scripts]) await useLibrary.getState().remove(script.id);

    resetLibraryForTests();
    await useLibrary.getState().init();
    expect(useLibrary.getState().scripts).toHaveLength(0);
  });

  it('journals unsaved edits synchronously when the page is hidden, even across repeated events', async () => {
    const library = useLibrary.getState();
    await library.init();
    const script = await library.create({ title: 'draft' });
    library.update(script.id, { body: 'مرحبا بكم' });

    // Hidden, then unloaded: the second event must not drop the backup of the in-flight write.
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
    window.dispatchEvent(new Event('pagehide'));

    const journal = JSON.parse(localStorage.getItem('tp:pending') ?? '[]') as { id: string; body: string }[];
    expect(journal.find((s) => s.id === script.id)?.body).toBe('مرحبا بكم');
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
  });

  it('restores journaled edits on the next start', async () => {
    await useLibrary.getState().init();
    const script = await useLibrary.getState().create({ title: 'draft' });
    localStorage.setItem(
      'tp:pending',
      JSON.stringify([{ ...script, body: 'نص محفوظ', updatedAt: script.updatedAt + 1 }]),
    );

    resetLibraryForTests();
    await useLibrary.getState().init();
    expect(useLibrary.getState().scripts.find((s) => s.id === script.id)?.body).toBe('نص محفوظ');
    expect(localStorage.getItem('tp:pending')).toBeNull();
  });

  it('debounces saves and marks scripts as saving until written', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    await useLibrary.getState().init();
    const script = await useLibrary.getState().create();
    useLibrary.getState().update(script.id, { title: 'a' });
    useLibrary.getState().update(script.id, { title: 'ab' });
    expect(useLibrary.getState().saving[script.id]).toBe(true);
    await vi.advanceTimersByTimeAsync(500);
    await vi.waitFor(() => expect(useLibrary.getState().saving[script.id]).toBeUndefined());
  });
});
