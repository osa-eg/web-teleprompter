import type { DataConnection, Peer } from 'peerjs';
import type { Command } from '@/core/commands/types';
import {
  parseHostMessage,
  PING_INTERVAL_MS,
  PROTOCOL_VERSION,
  SILENCE_TIMEOUT_MS,
  type PhoneMessage,
  type RemoteState,
  type ScriptInfo,
} from '@/core/remote/protocol';
import type { RemoteLink } from '@/core/remote/security';
import { peerOptions } from './peerOptions';

export type ClientStatus =
  'connecting' | 'connected' | 'reconnecting' | 'unreachable' | 'denied' | 'full' | 'error';

export interface ClientSnapshot {
  status: ClientStatus;
  script: ScriptInfo | null;
  state: RemoteState | null;
}

const NETWORK_ERRORS = new Set(['network', 'server-error', 'socket-error', 'socket-closed', 'disconnected']);

/**
 * The phone side of the remote: connects to the prompter's peer, authenticates with the secret from
 * the link, and reconnects on its own (with backoff) after sleep, network changes or a reload of
 * the prompter. A denied key stops it for good.
 */
export class RemoteClient {
  private readonly link: RemoteLink;
  private readonly name: string;
  private peer: Peer | null = null;
  private conn: DataConnection | null = null;
  private snapshot: ClientSnapshot = { status: 'connecting', script: null, state: null };
  private readonly listeners = new Set<() => void>();
  private running = false;
  private attempts = 0;
  private lastHeard = 0;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;

  constructor(link: RemoteLink, name: string) {
    this.link = link;
    this.name = name;
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): ClientSnapshot => this.snapshot;

  start(): void {
    if (this.running) return;
    this.running = true;
    this.attempts = 0;
    this.pingTimer = setInterval(() => this.heartbeat(), PING_INTERVAL_MS);
    document.addEventListener('visibilitychange', this.onVisibility);
    void this.openPeer();
  }

  stop(): void {
    this.running = false;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    if (this.pingTimer) clearInterval(this.pingTimer);
    this.retryTimer = null;
    this.pingTimer = null;
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.conn?.close();
    this.conn = null;
    this.peer?.destroy();
    this.peer = null;
  }

  send(command: Command): void {
    if (this.snapshot.status === 'connected') this.post({ t: 'cmd', cmd: command });
  }

  // ── Connection ───────────────────────────────────────────────────────────────

  private async openPeer(): Promise<void> {
    let PeerClass: typeof Peer;
    try {
      ({ Peer: PeerClass } = await import('peerjs'));
    } catch {
      this.set({ status: 'error' });
      return;
    }
    if (!this.running) return;
    const peer = new PeerClass(peerOptions(this.link.server));
    this.peer = peer;
    peer.on('open', () => this.connect());
    peer.on('error', (error) => {
      if (!this.running || this.peer !== peer) return;
      if (error.type === 'peer-unavailable') {
        // The prompter is closed or its remote is off: keep trying.
        this.set({ status: 'unreachable' });
        this.retry();
      } else if (NETWORK_ERRORS.has(error.type)) {
        this.set({ status: this.snapshot.status === 'connecting' ? 'connecting' : 'reconnecting' });
        this.retry(true);
      } else if (error.type !== 'webrtc') {
        this.set({ status: 'error' });
      }
    });
  }

  private connect(): void {
    const peer = this.peer;
    if (!peer || !this.running) return;
    this.conn?.close();
    const conn = peer.connect(this.link.hostId, { serialization: 'raw', reliable: true });
    this.conn = conn;
    conn.on('open', () => {
      this.lastHeard = Date.now();
      this.post({ t: 'auth', v: PROTOCOL_VERSION, key: this.link.key, name: this.name });
    });
    conn.on('data', (data) => this.receive(data));
    conn.on('close', () => this.lost(conn));
    conn.on('error', () => this.lost(conn));
  }

  private receive(data: unknown): void {
    const message = parseHostMessage(data);
    if (!message) return;
    this.lastHeard = Date.now();
    switch (message.t) {
      case 'welcome':
        this.attempts = 0;
        this.set({ status: 'connected', script: message.script });
        return;
      case 'state':
        this.set({ state: message.s });
        return;
      case 'denied':
        this.set({ status: message.reason === 'full' ? 'full' : 'denied' });
        this.stop();
        return;
      case 'pong':
        return;
    }
  }

  private lost(conn: DataConnection): void {
    if (conn !== this.conn) return;
    this.conn = null;
    if (!this.running) return;
    this.set({ status: 'reconnecting' });
    this.retry();
  }

  /** Reconnects after 1, 2, 4, 8, then every 10 seconds (a new peer when the old one is broken). */
  private retry(newPeer = false): void {
    if (!this.running) return;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    const delay = Math.min(10_000, 1000 * 2 ** Math.min(this.attempts++, 4));
    this.retryTimer = setTimeout(() => this.reconnectNow(newPeer), delay);
  }

  private reconnectNow(newPeer = false): void {
    this.retryTimer = null;
    if (!this.running) return;
    const peer = this.peer;
    if (!newPeer && peer && peer.open) {
      this.connect();
    } else if (!newPeer && peer && peer.disconnected && !peer.destroyed) {
      peer.reconnect();
    } else {
      peer?.destroy();
      this.peer = null;
      void this.openPeer();
    }
  }

  private heartbeat(): void {
    const conn = this.conn;
    if (!conn?.open) return;
    if (Date.now() - this.lastHeard > SILENCE_TIMEOUT_MS) {
      // The prompter went away without closing the connection (sleep, network change).
      conn.close();
      this.lost(conn);
      return;
    }
    this.post({ t: 'ping' });
  }

  private readonly onVisibility = () => {
    if (document.visibilityState !== 'visible' || !this.running) return;
    if (this.snapshot.status !== 'connected' || !this.conn?.open) {
      this.attempts = 0;
      if (this.retryTimer) clearTimeout(this.retryTimer);
      this.reconnectNow();
    }
  };

  private post(message: PhoneMessage): void {
    try {
      if (this.conn?.open) void this.conn.send(JSON.stringify(message));
    } catch {
      // The connection just closed; the close handler reconnects.
    }
  }

  private set(patch: Partial<ClientSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...patch };
    for (const listener of this.listeners) listener();
  }
}
