import { describe, expect, it } from 'vitest';
import type { EngineCommand } from '../commands/types';
import type { EngineSnapshot } from '../engine/types';
import type { SyncMessage, SyncRole } from './protocol';
import { HANDOFF_TIMEOUT_MS, JOIN_WAIT_MS, LEADER_TIMEOUT_MS, SyncSession } from './session';

const IDLE: EngineSnapshot = {
  play: 'idle',
  holding: false,
  moving: false,
  pos: 0,
  seekPos: null,
  wpm: 120,
  elapsedMs: 0,
  remainingMs: 60_000,
  countdownMs: null,
  holdMs: null,
  gate: true,
  voiceWord: -1,
};

/** A shared message bus with a manual clock; messages are delivered in order when flushed. */
class Net {
  time = 1000;
  windows: FakeWindow[] = [];
  private queue: { from: FakeWindow; message: SyncMessage }[] = [];
  /** Windows that currently cannot hear anything (simulated freeze/partition). */
  deaf = new Set<FakeWindow>();
  log: SyncMessage[] = [];

  post(from: FakeWindow, message: SyncMessage) {
    this.log.push(message);
    this.queue.push({ from, message });
  }

  flush() {
    for (let guard = 0; this.queue.length && guard < 10_000; guard++) {
      const { from, message } = this.queue.shift()!;
      // Structured clone, like BroadcastChannel.
      const copy: unknown = JSON.parse(JSON.stringify(message));
      for (const w of this.windows) if (w !== from && w.open && !this.deaf.has(w)) w.session.receive(copy);
    }
  }

  /** Advances time in 250 ms ticks, delivering messages in between. */
  run(ms: number) {
    const end = this.time + ms;
    while (this.time < end) {
      this.time = Math.min(end, this.time + 250);
      for (const w of this.windows) if (w.open && !this.deaf.has(w)) w.session.tick();
      this.flush();
    }
  }
}

class FakeWindow {
  mode: 'lead' | 'follow' = 'lead';
  snap: EngineSnapshot = { ...IDLE };
  commands: EngineCommand[] = [];
  requestedScript: string | null = null;
  open = true;
  session: SyncSession;

  constructor(
    net: Net,
    id: string,
    role: SyncRole,
    options: { script?: string; visible?: boolean; since?: number; deaf?: boolean } = {},
  ) {
    this.session = new SyncSession({
      id,
      role,
      script: options.script ?? 'script-1',
      visible: options.visible ?? true,
      since: options.since ?? net.time,
      now: () => net.time,
      post: (message) => net.post(this, message),
      delegate: {
        snapshot: () => this.snap,
        lead: (snap, { pause }) => {
          this.mode = 'lead';
          if (snap) this.snap = { ...snap };
          if (pause && (this.snap.play === 'playing' || this.snap.play === 'countdown')) {
            this.snap = { ...this.snap, play: 'paused', moving: false };
          }
        },
        follow: (snap) => {
          this.mode = 'follow';
          this.snap = { ...snap };
        },
        command: (command) => {
          this.commands.push(command);
          if (command.type === 'play') this.snap = { ...this.snap, play: 'playing', moving: true };
        },
        changed: () => undefined,
        scriptChanged: (script) => (this.requestedScript = script),
      },
    });
    net.windows.push(this);
    if (options.deaf) net.deaf.add(this);
    this.session.start();
    net.flush();
  }

  close() {
    this.session.stop();
    this.open = false;
  }

  /** Simulates playback progress on the leader. */
  play(pos: number) {
    this.snap = { ...this.snap, play: 'playing', moving: true, pos };
    this.session.localChanged();
  }
}

function leaders(net: Net) {
  return net.windows.filter((w) => w.open && w.session.isLeader());
}

describe('SyncSession', () => {
  it('leads alone after waiting for an existing leader', () => {
    const net = new Net();
    const operator = new FakeWindow(net, 'op', 'operator');
    net.run(JOIN_WAIT_MS - 250);
    expect(operator.session.isLeader()).toBe(false);
    net.run(500);
    expect(operator.session.isLeader()).toBe(true);
    expect(operator.mode).toBe('lead');
  });

  it('hands playback to a display window, which then gets the commands', () => {
    const net = new Net();
    const operator = new FakeWindow(net, 'op', 'operator');
    net.run(1000);
    operator.play(42);
    const display = new FakeWindow(net, 'disp', 'display');
    net.run(250);
    expect(leaders(net)).toEqual([display]);
    expect(display.snap.pos).toBe(42);
    expect(display.snap.play).toBe('playing');
    expect(operator.mode).toBe('follow');

    display.play(50);
    net.flush();
    expect(operator.snap.pos).toBe(50);

    expect(operator.session.sendCommand({ type: 'pause' })).toBe(true);
    net.flush();
    expect(display.commands).toEqual([{ type: 'pause' }]);
    expect(operator.session.getInfo().peers.map((p) => p.role)).toEqual(['display']);
  });

  it('moves playback to a visible window when the display is hidden, and back', () => {
    const net = new Net();
    const operator = new FakeWindow(net, 'op', 'operator');
    net.run(1000);
    const display = new FakeWindow(net, 'disp', 'display');
    net.run(250);
    display.play(10);
    display.session.setVisible(false);
    net.flush();
    expect(leaders(net)).toEqual([operator]);
    expect(operator.snap.play).toBe('playing');

    display.session.setVisible(true);
    net.flush();
    expect(leaders(net)).toEqual([display]);
  });

  it('pauses on the operator when the display window closes', () => {
    const net = new Net();
    const operator = new FakeWindow(net, 'op', 'operator');
    net.run(1000);
    const display = new FakeWindow(net, 'disp', 'display');
    net.run(250);
    display.play(77);
    net.flush();
    display.close();
    net.flush();
    expect(leaders(net)).toEqual([operator]);
    expect(operator.snap).toMatchObject({ pos: 77, play: 'paused' });
  });

  it('keeps the display playing when the operator window closes', () => {
    const net = new Net();
    const operator = new FakeWindow(net, 'op', 'operator');
    net.run(1000);
    const display = new FakeWindow(net, 'disp', 'display');
    net.run(250);
    display.play(5);
    operator.close();
    net.run(5000);
    expect(leaders(net)).toEqual([display]);
    expect(display.snap.play).toBe('playing');
  });

  it('takes over, paused, when the leader disappears without saying goodbye', () => {
    const net = new Net();
    const operator = new FakeWindow(net, 'op', 'operator');
    net.run(1000);
    const display = new FakeWindow(net, 'disp', 'display');
    net.run(250);
    display.play(30);
    net.flush();
    display.open = false; // crashed
    net.run(LEADER_TIMEOUT_MS - 500);
    expect(operator.session.isLeader()).toBe(false);
    net.run(1000);
    expect(leaders(net)).toEqual([operator]);
    expect(operator.snap).toMatchObject({ pos: 30, play: 'paused' });
  });

  it('resolves two leaders into one', () => {
    const net = new Net();
    const a = new FakeWindow(net, 'a', 'operator', { since: 1 });
    const b = new FakeWindow(net, 'b', 'operator', { since: 2 });
    net.deaf.add(b);
    net.run(1000);
    net.deaf.clear();
    net.deaf.add(a);
    net.run(1000);
    net.deaf.clear();
    expect(leaders(net)).toHaveLength(2);
    net.run(2000);
    expect(leaders(net)).toHaveLength(1);
    // The older operator leads, the other follows it.
    expect(leaders(net)).toEqual([a]);
    expect(b.mode).toBe('follow');
  });

  it('reclaims playback when a handoff is not taken', () => {
    const net = new Net();
    const operator = new FakeWindow(net, 'op', 'operator');
    net.run(1000);
    // It announces itself, then freezes before it can take over.
    const display = new FakeWindow(net, 'disp', 'display', { deaf: true });
    net.run(250);
    expect(operator.session.isLeader()).toBe(false);
    display.open = false;
    net.run(HANDOFF_TIMEOUT_MS + 500);
    expect(leaders(net)).toEqual([operator]);
  });

  it('ignores invalid messages and other scripts', () => {
    const net = new Net();
    const operator = new FakeWindow(net, 'op', 'operator');
    net.run(1000);
    operator.session.receive({ k: 'state', id: 'x', term: 99, script: 'script-1', snap: { pos: -1 } });
    operator.session.receive('garbage');
    operator.session.receive({ k: 'state', id: 'x', term: 99, script: 'other', snap: IDLE });
    expect(operator.session.isLeader()).toBe(true);
    const other = new FakeWindow(net, 'disp', 'display', { script: 'other' });
    net.run(1000);
    expect(operator.session.isLeader()).toBe(true);
    expect(other.session.isLeader()).toBe(true);
  });

  it('makes display windows follow the operator to another script', () => {
    const net = new Net();
    const display = new FakeWindow(net, 'disp', 'display', { script: 'a' });
    net.run(1000);
    const operator = new FakeWindow(net, 'op', 'operator', { script: 'b' });
    net.flush();
    expect(display.requestedScript).toBe('b');
    expect(operator.requestedScript).toBeNull();
  });

  it('does not deliver commands without a leader', () => {
    const net = new Net();
    const operator = new FakeWindow(net, 'op', 'operator');
    expect(operator.session.sendCommand({ type: 'play' })).toBe(false);
    net.run(1000);
    expect(operator.session.sendCommand({ type: 'play' })).toBe(false); // it leads itself
    expect(net.log.some((m) => m.k === 'cmd')).toBe(false);
  });
});
