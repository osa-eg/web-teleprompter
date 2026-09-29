import type { DataConnection, Peer, PeerOptions } from 'peerjs';
import type { Command } from '@/core/commands/types';
import {
  AUTH_TIMEOUT_MS,
  isRemoteCommandAllowed,
  MAX_DEVICES,
  MAX_PENDING,
  parsePhoneMessage,
  PHONE_RATE,
  PROTOCOL_VERSION,
  SILENCE_TIMEOUT_MS,
  type HostMessage,
  type RemoteState,
  type ScriptInfo,
} from '@/core/remote/protocol';
import { safeEqual, TokenBucket } from '@/core/remote/security';

export type HostStatus = 'off' | 'starting' | 'ready' | 'error';

export interface RemoteDevice {
  id: string;
  name: string;
  since: number;
}

export interface HostInfo {
  status: HostStatus;
  devices: readonly RemoteDevice[];
}

export const HOST_OFF: HostInfo = { status: 'off', devices: [] };

interface Link {
  id: string;
  conn: DataConnection;
  authed: boolean;
  name: string;
  since: number;
  bucket: TokenBucket;
  strikes: number;
  lastSeen: number;
  authTimer: ReturnType<typeof setTimeout> | null;
}

export interface RemoteHostOptions {
  hostId: string;
  key: string;
  peer: PeerOptions;
  onCommand: (command: Command) => void;
  /** The script on screen (null while no prompter is open). */
  script: () => ScriptInfo | null;
  state: () => RemoteState | null;
  canChangeLook: () => boolean;
  onChange: (info: HostInfo) => void;
}

const STATE_INTERVAL_MS = 250;
const MAX_STRIKES = 50;
/** Peer errors that a new attempt may fix. */
const RETRYABLE = new Set(['network', 'server-error', 'socket-error', 'socket-closed', 'unavailable-id']);

/**
 * The prompter side of the phone remote: a PeerJS peer with a secret id that phones connect to.
 * Every connection must present the secret key within a few seconds; messages are size-checked,
 * validated and rate-limited, and phones may only send playback (and, if allowed, look) commands.
 */
export class RemoteHost {
  private readonly options: RemoteHostOptions;
  private peer: Peer | null = null;
  private readonly links = new Map<string, Link>();
  private status: HostStatus = 'off';
  private stopped = false;
  private attempts = 0;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private watchdog: ReturnType<typeof setInterval> | null = null;
  private lastState = '';
  private lastStateAt = 0;
  private stateTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(options: RemoteHostOptions) {
    this.options = options;
  }

  async start(): Promise<void> {
    this.setStatus('starting');
    this.watchdog ??= setInterval(() => this.dropSilent(), 2000);
    let PeerClass: typeof Peer;
    try {
      ({ Peer: PeerClass } = await import('peerjs'));
    } catch {
      this.setStatus('error');
      return;
    }
    if (this.stopped) return;
    const peer = new PeerClass(this.options.hostId, this.options.peer);
    this.peer = peer;
    peer.on('open', () => {
      this.attempts = 0;
      this.setStatus('ready');
    });
    peer.on('connection', (conn) => this.accept(conn));
    peer.on('disconnected', () => {
      // Lost the signaling server: existing phones stay connected, new ones need it back.
      if (this.stopped || peer.destroyed) return;
      this.setStatus('starting');
      this.schedule(() => peer.reconnect());
    });
    peer.on('error', (error) => {
      if (this.stopped || error.type === 'peer-unavailable' || error.type === 'webrtc') return;
      this.setStatus('error');
      if (RETRYABLE.has(error.type)) this.schedule(() => this.restart());
    });
  }

  stop(): void {
    this.stopped = true;
    for (const link of this.links.values()) this.close(link);
    this.links.clear();
    if (this.retryTimer) clearTimeout(this.retryTimer);
    if (this.watchdog) clearInterval(this.watchdog);
    if (this.stateTimer) clearTimeout(this.stateTimer);
    this.peer?.destroy();
    this.peer = null;
    this.setStatus('off');
  }

  /** Tries again right away (after an error). */
  retry(): void {
    if (this.stopped) return;
    this.attempts = 0;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.restart();
  }

  disconnect(deviceId: string): void {
    const link = this.links.get(deviceId);
    if (link) this.drop(link);
  }

  /** The script changed (or the prompter closed): tell every phone. */
  sendWelcome(): void {
    const script = this.options.script();
    for (const link of this.links.values()) {
      if (link.authed) this.send(link, { t: 'welcome', v: PROTOCOL_VERSION, script });
    }
  }

  /**
   * Sends the playback state: discrete changes (play state, section, speed…) right away, the
   * running clock and progress at most four times a second.
   */
  broadcastState(state: RemoteState): void {
    const key = JSON.stringify({ ...state, elapsedMs: 0, remainingMs: 0, progress: 0 });
    const now = Date.now();
    if (key !== this.lastState || now - this.lastStateAt >= STATE_INTERVAL_MS) {
      this.lastState = key;
      this.flushState(now);
    } else if (!this.stateTimer) {
      this.stateTimer = setTimeout(() => this.flushState(Date.now()), STATE_INTERVAL_MS);
    }
  }

  private flushState(now: number): void {
    if (this.stateTimer) clearTimeout(this.stateTimer);
    this.stateTimer = null;
    this.lastStateAt = now;
    const state = this.options.state();
    if (!state) return;
    for (const link of this.links.values()) if (link.authed) this.send(link, { t: 'state', s: state });
  }

  // ── Connections ──────────────────────────────────────────────────────────────

  private accept(conn: DataConnection): void {
    let pending = 0;
    for (const link of this.links.values()) if (!link.authed) pending++;
    if (this.stopped || pending >= MAX_PENDING) {
      conn.close();
      return;
    }
    const now = Date.now();
    const link: Link = {
      id: conn.connectionId,
      conn,
      authed: false,
      name: '',
      since: now,
      bucket: new TokenBucket(PHONE_RATE),
      strikes: 0,
      lastSeen: now,
      authTimer: setTimeout(() => this.deny(link, 'timeout'), AUTH_TIMEOUT_MS),
    };
    this.links.set(link.id, link);
    conn.on('data', (data) => this.receive(link, data));
    conn.on('close', () => this.drop(link));
    conn.on('error', () => this.drop(link));
  }

  private receive(link: Link, data: unknown): void {
    if (!this.links.has(link.id)) return;
    const now = Date.now();
    if (!link.bucket.take(now)) return this.strike(link);
    const message = parsePhoneMessage(data);
    if (!message) return this.strike(link);
    link.lastSeen = now;

    if (!link.authed) {
      if (message.t !== 'auth' || !safeEqual(message.key, this.options.key)) return this.deny(link, 'key');
      if (this.devices().length >= MAX_DEVICES) return this.deny(link, 'full');
      link.authed = true;
      link.name = message.name.trim() || 'Phone';
      if (link.authTimer) clearTimeout(link.authTimer);
      link.authTimer = null;
      this.send(link, { t: 'welcome', v: PROTOCOL_VERSION, script: this.options.script() });
      const state = this.options.state();
      if (state) this.send(link, { t: 'state', s: state });
      this.notify();
      return;
    }

    if (message.t === 'ping') this.send(link, { t: 'pong' });
    else if (message.t === 'cmd' && isRemoteCommandAllowed(message.cmd, this.options.canChangeLook())) {
      this.options.onCommand(message.cmd);
    }
  }

  private strike(link: Link): void {
    if (++link.strikes > MAX_STRIKES) this.drop(link);
  }

  private deny(link: Link, reason: 'key' | 'full' | 'timeout'): void {
    if (!this.links.has(link.id)) return;
    this.send(link, { t: 'denied', reason });
    this.links.delete(link.id);
    if (link.authTimer) clearTimeout(link.authTimer);
    // Let the message go out before closing.
    setTimeout(() => link.conn.close(), 300);
  }

  private drop(link: Link): void {
    if (!this.links.delete(link.id)) return;
    this.close(link);
    if (link.authed) this.notify();
  }

  private close(link: Link): void {
    if (link.authTimer) clearTimeout(link.authTimer);
    try {
      link.conn.close();
    } catch {
      // already closed
    }
  }

  private dropSilent(): void {
    const now = Date.now();
    for (const link of this.links.values()) {
      if (link.authed && now - link.lastSeen > SILENCE_TIMEOUT_MS) this.drop(link);
    }
  }

  private send(link: Link, message: HostMessage): void {
    if (!link.conn.open) return;
    try {
      void link.conn.send(JSON.stringify(message));
    } catch {
      this.drop(link);
    }
  }

  // ── Status ───────────────────────────────────────────────────────────────────

  private schedule(action: () => void): void {
    if (this.retryTimer) clearTimeout(this.retryTimer);
    const delay = Math.min(30_000, 2000 * 2 ** Math.min(this.attempts++, 4));
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      if (!this.stopped) action();
    }, delay);
  }

  private restart(): void {
    this.peer?.destroy();
    this.peer = null;
    void this.start();
  }

  private devices(): RemoteDevice[] {
    const devices: RemoteDevice[] = [];
    for (const link of this.links.values()) {
      if (link.authed) devices.push({ id: link.id, name: link.name, since: link.since });
    }
    return devices;
  }

  private setStatus(status: HostStatus): void {
    if (status === this.status) return;
    this.status = status;
    this.notify();
  }

  private notify(): void {
    this.options.onChange({ status: this.status, devices: this.devices() });
  }
}
