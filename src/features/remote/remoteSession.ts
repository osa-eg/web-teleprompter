import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { newHostId, newSecret } from '@/core/remote/security';

interface RemoteSessionState {
  /** The phone remote is turned on in this tab. */
  on: boolean;
  hostId: string;
  key: string;
  setOn(on: boolean): void;
  /** New id and secret: the old code stops working and every phone is disconnected. */
  rotate(): void;
}

/**
 * Per-tab remote identity (sessionStorage), so phones reconnect by themselves after the operator
 * reloads the page or goes to the editor and back.
 */
export const useRemoteSession = create<RemoteSessionState>()(
  persist(
    (set) => ({
      on: false,
      hostId: newHostId(),
      key: newSecret(),
      setOn: (on) => set({ on }),
      rotate: () => set({ hostId: newHostId(), key: newSecret() }),
    }),
    {
      name: 'tp:remote',
      version: 1,
      storage: createJSONStorage(() => sessionStorage),
      partialize: ({ on, hostId, key }) => ({ on, hostId, key }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<RemoteSessionState>;
        const valid =
          typeof p.hostId === 'string' &&
          /^tp-[0-9a-z]{20}$/.test(p.hostId) &&
          typeof p.key === 'string' &&
          /^[\w-]{22}$/.test(p.key);
        return valid ? { ...current, on: p.on === true, hostId: p.hostId!, key: p.key! } : current;
      },
    },
  ),
);
