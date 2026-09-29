import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { CustomFontRecord, Script } from './types';

export const DB_NAME = 'web-teleprompter';
export const DB_VERSION = 1;

export interface TeleprompterDB extends DBSchema {
  scripts: { key: string; value: Script; indexes: { updatedAt: number } };
  fonts: { key: string; value: CustomFontRecord };
  kv: { key: string; value: unknown };
}

export type Database = IDBPDatabase<TeleprompterDB>;

let dbPromise: Promise<Database> | null = null;
const blockedListeners = new Set<() => void>();

/** Called when another tab needs this connection closed to upgrade the schema. */
export function onDatabaseBlocked(listener: () => void): () => void {
  blockedListeners.add(listener);
  return () => blockedListeners.delete(listener);
}

export function getDatabase(): Promise<Database> {
  dbPromise ??= openDB<TeleprompterDB>(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        const scripts = db.createObjectStore('scripts', { keyPath: 'id' });
        scripts.createIndex('updatedAt', 'updatedAt');
        db.createObjectStore('fonts', { keyPath: 'id' });
        db.createObjectStore('kv');
      }
    },
    blocking() {
      void dbPromise?.then((db) => db.close());
      dbPromise = null;
      for (const listener of blockedListeners) listener();
    },
    terminated() {
      dbPromise = null;
    },
  }).catch((error: unknown) => {
    dbPromise = null;
    throw error;
  });
  return dbPromise;
}

/** Test helper: forget the cached connection. */
export function resetDatabaseConnection(): void {
  void dbPromise?.then((db) => db.close()).catch(() => undefined);
  dbPromise = null;
}
