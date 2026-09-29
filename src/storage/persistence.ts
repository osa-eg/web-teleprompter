let requested = false;

/**
 * Asks the browser to exempt this site's storage from automatic eviction. Called after a user
 * action (creating or importing a script) because Firefox shows a permission prompt.
 */
export async function requestPersistence(): Promise<boolean> {
  if (requested || typeof navigator === 'undefined' || !navigator.storage?.persist) return false;
  requested = true;
  try {
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

export interface StorageStatus {
  persisted: boolean;
  usage: number | null;
  quota: number | null;
}

export async function storageStatus(): Promise<StorageStatus> {
  const storage = typeof navigator === 'undefined' ? undefined : navigator.storage;
  const persisted = (await storage?.persisted?.().catch(() => false)) ?? false;
  const estimate = await storage?.estimate?.().catch(() => undefined);
  return { persisted, usage: estimate?.usage ?? null, quota: estimate?.quota ?? null };
}
