import { create } from 'zustand';
import { sampleScripts } from '@/features/library/sampleScripts';
import { randomId } from '@/storage/ids';
import { openScriptsRepo, type ScriptsRepo } from '@/storage/scriptsRepo';
import type { Script } from '@/storage/types';
import { useSettings } from './settings';

const SAVE_DELAY_MS = 400;
const CHANNEL_NAME = 'tp:db';

type ScriptPatch = Partial<Omit<Script, 'id' | 'createdAt' | 'updatedAt'>>;
type DbMessage = { type: 'put' | 'delete'; id: string };

export interface LibraryState {
  status: 'idle' | 'loading' | 'ready';
  /** False when scripts only live in memory (storage blocked). */
  persistent: boolean;
  scripts: Script[];
  /** Ids with edits not yet written to storage. */
  saving: Record<string, true>;
  init(): Promise<void>;
  create(input?: Partial<Pick<Script, 'title' | 'body' | 'direction'>>): Promise<Script>;
  /** Updates a script in memory immediately and saves it after a short debounce. */
  update(id: string, patch: ScriptPatch, options?: { touch?: boolean }): void;
  remove(id: string): Promise<Script | undefined>;
  restore(script: Script): Promise<void>;
  duplicate(id: string, title: string): Promise<Script | undefined>;
  /** Writes all pending edits now (e.g. before the page is hidden). */
  flush(): Promise<void>;
}

let repo: ScriptsRepo | null = null;
let initPromise: Promise<void> | null = null;
let channel: BroadcastChannel | null = null;
const timers = new Map<string, ReturnType<typeof setTimeout>>();

function broadcast(message: DbMessage) {
  channel?.postMessage(message);
}

export const useLibrary = create<LibraryState>()((set, get) => {
  const replace = (script: Script) =>
    set((state) => {
      const exists = state.scripts.some((s) => s.id === script.id);
      return {
        scripts: exists
          ? state.scripts.map((s) => (s.id === script.id ? script : s))
          : [script, ...state.scripts],
      };
    });

  const clearSaving = (id: string) =>
    set((state) => {
      if (!state.saving[id]) return state;
      const saving = { ...state.saving };
      delete saving[id];
      return { saving };
    });

  async function write(id: string) {
    timers.delete(id);
    const script = get().scripts.find((s) => s.id === id);
    if (!script || !repo) return;
    await repo.put(script);
    if (!timers.has(id)) clearSaving(id);
    broadcast({ type: 'put', id });
  }

  async function onRemoteChange(message: DbMessage) {
    if (!repo || timers.has(message.id)) return; // local unsaved edits win
    if (message.type === 'delete') {
      set((state) => ({ scripts: state.scripts.filter((s) => s.id !== message.id) }));
      return;
    }
    const script = await repo.get(message.id);
    if (script) replace(script);
  }

  return {
    status: 'idle',
    persistent: true,
    scripts: [],
    saving: {},

    init() {
      initPromise ??= (async () => {
        set({ status: 'loading' });
        repo = await openScriptsRepo();
        let scripts = await repo.list();
        if (scripts.length === 0 && !(await repo.getMeta<boolean>('seeded'))) {
          const now = Date.now();
          const lang = useSettings.getState().settings.ui.lang;
          scripts = sampleScripts(lang).map((sample, i) => ({
            ...sample,
            id: randomId(),
            createdAt: now - i * 1000,
            updatedAt: now - i * 1000,
          }));
          for (const script of scripts) await repo.put(script);
          await repo.setMeta('seeded', true);
        }
        set({ status: 'ready', persistent: repo.persistent, scripts });

        if (typeof BroadcastChannel !== 'undefined') {
          channel = new BroadcastChannel(CHANNEL_NAME);
          channel.onmessage = (event: MessageEvent<DbMessage>) => void onRemoteChange(event.data);
        }
        if (typeof window !== 'undefined') {
          window.addEventListener('pagehide', () => void get().flush());
          document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') void get().flush();
          });
        }
      })();
      return initPromise;
    },

    async create(input = {}) {
      await get().init();
      const now = Date.now();
      const script: Script = {
        id: randomId(),
        title: input.title ?? '',
        body: input.body ?? '',
        direction: input.direction ?? 'auto',
        createdAt: now,
        updatedAt: now,
      };
      replace(script);
      await repo?.put(script);
      broadcast({ type: 'put', id: script.id });
      return script;
    },

    update(id, patch, options = {}) {
      const current = get().scripts.find((s) => s.id === id);
      if (!current) return;
      const touch = options.touch ?? true;
      replace({ ...current, ...patch, updatedAt: touch ? Date.now() : current.updatedAt });
      set((state) => ({ saving: { ...state.saving, [id]: true } }));
      const pending = timers.get(id);
      if (pending) clearTimeout(pending);
      timers.set(
        id,
        setTimeout(() => void write(id), SAVE_DELAY_MS),
      );
    },

    async remove(id) {
      const script = get().scripts.find((s) => s.id === id);
      if (!script) return undefined;
      const pending = timers.get(id);
      if (pending) clearTimeout(pending);
      timers.delete(id);
      clearSaving(id);
      set((state) => ({ scripts: state.scripts.filter((s) => s.id !== id) }));
      await repo?.delete(id);
      broadcast({ type: 'delete', id });
      return script;
    },

    async restore(script) {
      replace(script);
      await repo?.put(script);
      broadcast({ type: 'put', id: script.id });
    },

    async duplicate(id, title) {
      const source = get().scripts.find((s) => s.id === id);
      if (!source) return undefined;
      return get().create({ title, body: source.body, direction: source.direction });
    },

    async flush() {
      const ids = [...timers.keys()];
      for (const id of ids) clearTimeout(timers.get(id));
      await Promise.all(ids.map((id) => write(id)));
    },
  };
});

/** Test helper: drop module state so each test starts from a fresh library. */
export function resetLibraryForTests(): void {
  for (const timer of timers.values()) clearTimeout(timer);
  timers.clear();
  channel?.close();
  channel = null;
  repo = null;
  initPromise = null;
  useLibrary.setState({ status: 'idle', persistent: true, scripts: [], saving: {} });
}
