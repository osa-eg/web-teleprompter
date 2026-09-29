import type { EngineCommand } from '../commands/types';
import type { EngineSnapshot } from '../engine/types';
import { SyncMessageSchema, type SyncMessage, type SyncRole } from './protocol';

export const HEARTBEAT_MS = 1000;
/** How long a new window waits for an existing leader before leading itself. */
export const JOIN_WAIT_MS = 600;
export const LEADER_TIMEOUT_MS = 3000;
export const PEER_TIMEOUT_MS = 3500;
export const HANDOFF_TIMEOUT_MS = 1500;

export interface SyncPeer {
  id: string;
  role: SyncRole;
  visible: boolean;
  /** Wall-clock time the window joined (older windows win ties). */
  since: number;
  script: string;
  /** Local time of its last message. */
  seen: number;
}

export interface SyncDelegate {
  /** The local playback state, to broadcast or hand over. */
  snapshot(): EngineSnapshot;
  /** Run playback here, continuing from `snap` (null: from the local/last known state). */
  lead(snap: EngineSnapshot | null, options: { pause: boolean }): void;
  /** Mirror the leader. */
  follow(snap: EngineSnapshot): void;
  /** A command from another window (only delivered to the leader). */
  command(command: EngineCommand): void;
  /** Leadership or the set of connected windows changed. */
  changed(): void;
  /** Display windows: the operator moved on to another script. */
  scriptChanged?(script: string): void;
}

export interface SyncSessionOptions {
  id: string;
  role: SyncRole;
  script: string;
  visible: boolean;
  since: number;
  post: (message: SyncMessage) => void;
  now: () => number;
  delegate: SyncDelegate;
}

export interface SyncInfo {
  leader: boolean;
  leaderId: string | null;
  /** Other live windows of this session showing the same script. */
  peers: readonly SyncPeer[];
}

type Candidate = Pick<SyncPeer, 'id' | 'role' | 'visible' | 'since'>;

/** Visible display > visible operator > hidden display > hidden operator. */
function rank(c: Candidate): number {
  return (c.visible ? 2 : 0) + (c.role === 'display' ? 1 : 0);
}

function better(a: Candidate, b: Candidate): boolean {
  if (rank(a) !== rank(b)) return rank(a) > rank(b);
  if (a.since !== b.since) return a.since < b.since;
  return a.id < b.id;
}

/**
 * Keeps the windows of one prompter session in step: exactly one window (the leader) runs the scroll
 * engine and broadcasts its state; the others follow it and send it their commands.
 *
 * The leader is the window the talent reads from — a visible display window, else a visible
 * operator window — because hidden windows get no animation frames. Leadership moves by explicit
 * handoff (with the playback state), is reclaimed when the leader disappears, and conflicts resolve
 * by term (higher wins) and then id. Transport- and clock-agnostic: the owner delivers messages to
 * `receive` and calls `tick` a few times per second.
 */
export class SyncSession {
  private readonly options: SyncSessionOptions;
  private readonly peers = new Map<string, SyncPeer>();
  private visible: boolean;
  private leading = false;
  private leaderId: string | null = null;
  private term = 0;
  private leaderSeen = Number.NEGATIVE_INFINITY;
  /** When we noticed there is no leader (null while one is known). */
  private orphanedAt: number | null = null;
  /** Still waiting for a first contact with a leader after starting. */
  private joining = true;
  private handoffAt: number | null = null;
  private lastState = Number.NEGATIVE_INFINITY;
  private lastHello = Number.NEGATIVE_INFINITY;
  private requestedScript: string | null = null;
  private stopped = false;
  private info: SyncInfo = { leader: false, leaderId: null, peers: [] };

  constructor(options: SyncSessionOptions) {
    this.options = options;
    this.visible = options.visible;
  }

  get id(): string {
    return this.options.id;
  }

  isLeader(): boolean {
    return this.leading;
  }

  /** Stable snapshot for useSyncExternalStore; replaced whenever something changes. */
  getInfo = (): SyncInfo => this.info;

  start(): void {
    const now = this.options.now();
    this.orphanedAt = now;
    this.hello(now);
  }

  stop(): void {
    if (this.stopped) return;
    const now = this.options.now();
    if (this.leading) {
      const next = this.best(now, false);
      // When the talent's display closes, the operator takes over paused.
      if (next) this.handoff(next, now, this.options.role === 'display' && next.role !== 'display');
    }
    this.options.post({ k: 'bye', id: this.options.id });
    this.stopped = true;
  }

  setVisible(visible: boolean): void {
    if (this.stopped || visible === this.visible) return;
    this.visible = visible;
    const now = this.options.now();
    this.hello(now);
    this.reconsider(now);
  }

  /** The local engine's state changed: the leader broadcasts it. */
  localChanged(): void {
    if (this.leading && !this.stopped) this.postState(this.options.now());
  }

  /** Sends a follower's command to the leader. Returns false when there is no leader to send to. */
  sendCommand(command: EngineCommand): boolean {
    if (this.stopped || this.leading || !this.leaderId) return false;
    this.options.post({ k: 'cmd', id: this.options.id, to: this.leaderId, cmd: command });
    return true;
  }

  tick(): void {
    if (this.stopped) return;
    const now = this.options.now();
    if (now - this.lastHello >= HEARTBEAT_MS) this.hello(now);

    let changed = false;
    for (const peer of this.peers.values()) {
      if (peer.id !== this.leaderId && now - peer.seen > PEER_TIMEOUT_MS) {
        this.peers.delete(peer.id);
        changed = true;
      }
    }

    if (this.leading) {
      if (now - this.lastState >= HEARTBEAT_MS) this.postState(now);
      this.reconsider(now);
    } else {
      const handoffFailed = this.handoffAt !== null && now - this.handoffAt > HANDOFF_TIMEOUT_MS;
      if (this.leaderId !== null && (handoffFailed || now - this.leaderSeen > LEADER_TIMEOUT_MS)) {
        this.peers.delete(this.leaderId);
        this.leaderId = null;
        this.handoffAt = null;
        this.orphanedAt = now;
        changed = true;
      }
      if (this.leaderId === null) this.maybeClaim(now);
    }
    if (changed) this.notify();
  }

  receive(raw: unknown): void {
    if (this.stopped) return;
    const parsed = SyncMessageSchema.safeParse(raw);
    if (!parsed.success || parsed.data.id === this.options.id) return;
    const message = parsed.data;
    const now = this.options.now();
    switch (message.k) {
      case 'hello':
        return this.onHello(message, now);
      case 'state':
        return this.onState(message, now);
      case 'cmd':
        if (message.to === this.options.id && this.leading) this.options.delegate.command(message.cmd);
        return;
      case 'handoff':
        return this.onHandoff(message, now);
      case 'bye':
        return this.onBye(message.id, now);
    }
  }

  // ── Message handling ─────────────────────────────────────────────────────────

  private onHello(message: Extract<SyncMessage, { k: 'hello' }>, now: number): void {
    const known = this.peers.get(message.id);
    const peer: SyncPeer = { ...message, seen: now };
    this.peers.set(message.id, peer);
    // Introduce ourselves to newcomers right away so they can tell who should lead.
    if (!known) this.hello(now);
    if (this.options.role === 'display') this.followOperatorScript(now);
    const changed =
      !known || known.visible !== peer.visible || known.script !== peer.script || known.role !== peer.role;
    if (peer.script === this.options.script && this.leading) {
      // Newcomers and windows that just became visible learn the state right away.
      if (changed) this.postState(now);
      this.reconsider(now);
    }
    if (changed) this.notify();
  }

  private onState(message: Extract<SyncMessage, { k: 'state' }>, now: number): void {
    if (message.script !== this.options.script) return;
    const peer = this.peers.get(message.id);
    if (peer) peer.seen = now;
    if (this.leading) {
      const theyWin =
        message.term > this.term || (message.term === this.term && message.id < this.options.id);
      if (!theyWin) {
        // Two leaders: make sure the other one hears about us (it will yield).
        if (now - this.lastState > 100) this.postState(now);
        return;
      }
      this.leading = false;
    } else if (message.term < this.term) {
      return; // a stale leader
    }
    this.term = message.term;
    this.handoffAt = null;
    this.setLeader(message.id, now);
    this.options.delegate.follow(message.snap);
  }

  private onHandoff(message: Extract<SyncMessage, { k: 'handoff' }>, now: number): void {
    if (message.script !== this.options.script || message.term < this.term) return;
    this.term = message.term;
    this.handoffAt = null;
    if (message.to === this.options.id) {
      this.leading = true;
      this.setLeader(this.options.id, now);
      this.options.delegate.lead(message.snap, { pause: message.pause });
      this.postState(now);
    } else {
      this.leading = false;
      this.setLeader(message.to, now);
      this.options.delegate.follow(message.snap);
    }
  }

  private onBye(id: string, now: number): void {
    const known = this.peers.delete(id);
    if (this.leaderId === id) {
      this.leaderId = null;
      this.orphanedAt = now;
      this.maybeClaim(now);
      this.notify();
    } else if (known) {
      if (this.leading) this.reconsider(now);
      this.notify();
    }
  }

  // ── Leadership ───────────────────────────────────────────────────────────────

  private self(): Candidate {
    return { id: this.options.id, role: this.options.role, visible: this.visible, since: this.options.since };
  }

  /** The best live window of this script to lead (optionally including this one). */
  private best(now: number, includeSelf = true): Candidate | null {
    let best: Candidate | null = includeSelf ? this.self() : null;
    for (const peer of this.peers.values()) {
      if (peer.script !== this.options.script || now - peer.seen > PEER_TIMEOUT_MS) continue;
      if (!best || better(peer, best)) best = peer;
    }
    return best;
  }

  /** The leader passes playback on when a better window is around (e.g. a display appeared). */
  private reconsider(now: number): void {
    if (!this.leading || this.stopped) return;
    const best = this.best(now);
    if (best && best.id !== this.options.id) this.handoff(best, now, false);
  }

  private handoff(to: Candidate, now: number, pause: boolean): void {
    this.term += 1;
    const snap = this.options.delegate.snapshot();
    this.options.post({
      k: 'handoff',
      id: this.options.id,
      to: to.id,
      term: this.term,
      script: this.options.script,
      snap,
      pause,
    });
    this.leading = false;
    this.setLeader(to.id, now);
    this.handoffAt = now;
    this.options.delegate.follow(snap);
  }

  /** Without a leader: the best window leads right away (after the join wait), others later. */
  private maybeClaim(now: number): void {
    if (this.orphanedAt === null) this.orphanedAt = now;
    const isBest = this.best(now)?.id === this.options.id;
    const wait = isBest ? (this.joining ? JOIN_WAIT_MS : 0) : JOIN_WAIT_MS * 3;
    if (now - this.orphanedAt < wait) return;
    const lostLeader = !this.joining;
    this.term += 1;
    this.leading = true;
    this.setLeader(this.options.id, now);
    // A leader that vanished mid-read leaves playback paused where it was.
    this.options.delegate.lead(null, { pause: lostLeader });
    this.postState(now);
  }

  private setLeader(id: string, now: number): void {
    const changed = this.leaderId !== id || this.info.leader !== this.leading;
    this.leaderId = id;
    this.leaderSeen = now;
    this.orphanedAt = null;
    this.joining = false;
    if (changed) this.notify();
  }

  /** Display windows show whatever script the most recently opened operator window shows. */
  private followOperatorScript(now: number): void {
    let latest: SyncPeer | null = null;
    for (const peer of this.peers.values()) {
      if (peer.role !== 'operator' || now - peer.seen > PEER_TIMEOUT_MS) continue;
      if (!latest || peer.since > latest.since) latest = peer;
    }
    if (!latest || latest.script === this.options.script || latest.script === this.requestedScript) return;
    this.requestedScript = latest.script;
    this.options.delegate.scriptChanged?.(latest.script);
  }

  // ── Output ───────────────────────────────────────────────────────────────────

  private hello(now: number): void {
    this.lastHello = now;
    this.options.post({
      k: 'hello',
      id: this.options.id,
      role: this.options.role,
      visible: this.visible,
      since: this.options.since,
      script: this.options.script,
    });
  }

  private postState(now: number): void {
    this.lastState = now;
    this.options.post({
      k: 'state',
      id: this.options.id,
      term: this.term,
      script: this.options.script,
      snap: this.options.delegate.snapshot(),
    });
  }

  private notify(): void {
    const now = this.options.now();
    this.info = {
      leader: this.leading,
      leaderId: this.leaderId,
      peers: [...this.peers.values()].filter(
        (p) => p.script === this.options.script && now - p.seen <= PEER_TIMEOUT_MS,
      ),
    };
    this.options.delegate.changed();
  }
}
