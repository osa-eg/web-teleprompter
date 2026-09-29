import { useSyncExternalStore } from 'react';
import type { Command } from '@/core/commands/types';
import type { RemoteState, ScriptInfo } from '@/core/remote/protocol';
import { useSettings } from '@/stores/settings';
import { peerOptions, serverFromSettings } from './peerOptions';
import { HOST_OFF, RemoteHost, type HostInfo } from './RemoteHost';
import { useRemoteSession } from './remoteSession';

/** What the open prompter offers the phones. */
export interface RemoteController {
  script: ScriptInfo;
  onCommand(command: Command): void;
}

let host: RemoteHost | null = null;
let signature = '';
let controller: RemoteController | null = null;
let latestState: RemoteState | null = null;
let info: HostInfo = HOST_OFF;
const listeners = new Set<() => void>();

function setInfo(next: HostInfo) {
  info = next;
  for (const listener of listeners) listener();
}

/** Starts, restarts or stops the host to match the tab's remote switch and the server settings. */
function apply(force = false) {
  const { on, hostId, key } = useRemoteSession.getState();
  const server = serverFromSettings(useSettings.getState().settings.remote);
  const next = on ? JSON.stringify([hostId, key, server]) : '';
  if (next === signature && !force) return;
  signature = next;
  host?.stop();
  host = null;
  if (!on) {
    setInfo(HOST_OFF);
    return;
  }
  host = new RemoteHost({
    hostId,
    key,
    peer: peerOptions(server),
    onCommand: (command) => controller?.onCommand(command),
    script: () => controller?.script ?? null,
    state: () => latestState,
    canChangeLook: () => useSettings.getState().settings.remote.allowSettingChanges,
    onChange: setInfo,
  });
  void host.start();
}

let initialized = false;

/**
 * Runs the phone-remote host for this tab (operator tabs only: display windows and phones never
 * host). It lives outside the prompter so phones stay connected while the operator edits.
 */
export function initRemoteHostService(): void {
  if (initialized) return;
  initialized = true;
  useRemoteSession.subscribe(() => apply());
  useSettings.subscribe(() => apply());
  apply();
}

export function attachRemoteController(next: RemoteController): () => void {
  controller = next;
  host?.sendWelcome();
  return () => {
    if (controller !== next) return;
    controller = null;
    latestState = null;
    host?.sendWelcome();
  };
}

export function publishRemoteState(state: RemoteState): void {
  latestState = state;
  host?.broadcastState(state);
}

export function disconnectRemoteDevice(id: string): void {
  host?.disconnect(id);
}

export function retryRemoteHost(): void {
  if (host) host.retry();
  else apply(true);
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export function useRemoteHostInfo(): HostInfo {
  return useSyncExternalStore(subscribe, () => info);
}
