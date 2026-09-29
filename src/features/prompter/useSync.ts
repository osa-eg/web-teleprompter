import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { ScrollEngine } from '@/core/engine/ScrollEngine';
import type { SyncRole } from '@/core/sync/protocol';
import { SyncSession, type SyncInfo } from '@/core/sync/session';
import { CLOSE_DISPLAY } from '@/features/display/displayWindow';
import { randomId } from '@/storage/ids';

const NO_SYNC: SyncInfo = { leader: true, leaderId: null, peers: [] };
const TICK_MS = 250;

class InfoStore {
  private info: SyncInfo = NO_SYNC;
  private readonly listeners = new Set<() => void>();
  get = (): SyncInfo => this.info;
  set(info: SyncInfo) {
    if (info === this.info) return;
    this.info = info;
    for (const listener of this.listeners) listener();
  }
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
}

interface Options {
  engine: ScrollEngine;
  role: SyncRole;
  /** Session shared by the windows of one operator tab (null: this window works alone). */
  sid: string | null;
  scriptId: string;
  /** Display windows: the operator switched to another script. */
  onScriptChange?: (scriptId: string) => void;
}

/**
 * Joins this prompter window to its session over a BroadcastChannel: the window the talent reads
 * from runs playback, the others mirror it and forward their commands (see SyncSession).
 */
export function useSync({ engine, role, sid, scriptId, onScriptChange }: Options): SyncInfo {
  const [store] = useState(() => new InfoStore());
  const [epoch, setEpoch] = useState(0);
  const onScriptChangeRef = useRef(onScriptChange);
  useEffect(() => {
    onScriptChangeRef.current = onScriptChange;
  });

  useEffect(() => {
    if (!sid || typeof BroadcastChannel === 'undefined') return;
    const channel = new BroadcastChannel(`tp:s:${sid}`);
    const session = new SyncSession({
      id: randomId(12),
      role,
      script: scriptId,
      visible: document.visibilityState === 'visible',
      since: Date.now(),
      now: () => performance.now(),
      post: (message) => channel.postMessage(message),
      delegate: {
        snapshot: () => engine.exportSnapshot(),
        lead: (snap, options) => engine.lead(snap, options),
        follow: (snap) => engine.follow(snap),
        command: (command) => engine.dispatch(command),
        changed: () => store.set(session.getInfo()),
        scriptChanged: (id) => onScriptChangeRef.current?.(id),
      },
    });
    channel.onmessage = (event: MessageEvent) => {
      if (event.data === CLOSE_DISPLAY) {
        if (role === 'display') window.close();
        return;
      }
      session.receive(event.data);
    };
    engine.setForwarder((command) => session.sendCommand(command));
    const unsubscribe = engine.subscribe(() => session.localChanged());
    const onVisibility = () => session.setVisible(document.visibilityState === 'visible');
    const onPageHide = () => session.stop();
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onPageHide);
    const timer = setInterval(() => session.tick(), TICK_MS);
    session.start();

    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onPageHide);
      unsubscribe();
      session.stop();
      channel.close();
      engine.setForwarder(null);
      if (engine.getMode() === 'follow') engine.lead(null, { pause: true });
      store.set(NO_SYNC);
    };
  }, [engine, role, sid, scriptId, store, epoch]);

  // A page restored from the back/forward cache starts a fresh session.
  useEffect(() => {
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) setEpoch((n) => n + 1);
    };
    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, []);

  return useSyncExternalStore(store.subscribe, store.get);
}
