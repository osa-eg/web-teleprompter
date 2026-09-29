import { describe, expect, it } from 'vitest';
import type { EngineCommand } from '../commands/types';
import { ScrollEngine } from './ScrollEngine';
import { FakeHost, FakeSurface, makeModel, type ModelSpec } from './testing';
import type { EngineConfig } from './types';

// Leader: 100 lines × 5 words, 60 px per line (12 px per word, 24 px/s at 120 wpm).
// Follower: a narrower window — 250 lines × 2 words, 120 px per line — showing the same 500 words.
const LEADER: ModelSpec = { lines: 100, tokensPerLine: 5, lineHeight: 60 };
const FOLLOWER: ModelSpec = { lines: 250, tokensPerLine: 2, lineHeight: 120 };

function makeEngine(host: FakeHost, spec: ModelSpec, config: Partial<EngineConfig> = {}) {
  const model = makeModel(spec);
  const engine = new ScrollEngine(host, new FakeSurface(model), {
    wpm: 120,
    rampMs: 0,
    countdownSec: 0,
    spokenWords: model.tokenCount,
    ...config,
  });
  engine.relayout();
  return engine;
}

/** A leader and a follower sharing one clock; snapshots flow with every leader status update. */
function pair(config: Partial<EngineConfig> = {}, leaderSpec: ModelSpec = LEADER) {
  const host = new FakeHost();
  const leader = makeEngine(host, leaderSpec, config);
  const follower = makeEngine(host, FOLLOWER, config);
  const forwarded: EngineCommand[] = [];
  follower.setForwarder((command) => {
    forwarded.push(command);
    leader.dispatch(command);
  });
  let linked = true;
  leader.subscribe(() => {
    if (linked) follower.follow(leader.exportSnapshot());
  });
  follower.follow(leader.exportSnapshot());
  return { host, leader, follower, forwarded, unlink: () => (linked = false) };
}

describe('ScrollEngine follow mode', () => {
  it('follows a playing leader in its own layout', () => {
    const { host, leader, follower } = pair();
    expect(follower.getMode()).toBe('follow');
    leader.startPlay();
    host.run(5000);
    expect(leader.getPos()).toBeCloseTo(10, 0); // 2 words per second
    expect(Math.abs(follower.getPos() - leader.getPos())).toBeLessThan(0.3);
    expect(follower.getStatus().play).toBe('playing');
    expect(follower.getStatus().wpm).toBe(120);
  });

  it('extrapolates smoothly between sparse snapshots', () => {
    const { host, leader, follower, unlink } = pair();
    unlink();
    leader.startPlay();
    const positions: number[] = [];
    for (let i = 0; i < 20; i++) {
      host.run(250);
      follower.follow(leader.exportSnapshot()); // four snapshots per second
      positions.push(follower.getPx());
    }
    // 2 words/s × 60 px per word = 120 px/s in the follower's layout.
    const steps = positions.slice(8).map((px, i) => px - positions[7 + i]!);
    for (const step of steps) expect(step).toBeCloseTo(30, 0);
    expect(Math.abs(follower.getPos() - leader.getPos())).toBeLessThan(0.3);
  });

  it('stops extrapolating when the leader goes quiet', () => {
    const { host, leader, follower, unlink } = pair();
    leader.startPlay();
    host.run(2000);
    unlink();
    const pos = leader.getPos();
    host.run(3000);
    // At most 250 ms of extrapolation (0.5 words) past the last snapshot.
    expect(follower.getPos()).toBeLessThan(pos + 0.6);
  });

  it('forwards commands, scrolling and resume jumps to the leader', () => {
    const { host, leader, follower, forwarded } = pair();
    follower.dispatch({ type: 'toggle' });
    expect(leader.getStatus().play).toBe('playing');
    follower.pause();
    expect(leader.getStatus().play).toBe('paused');
    follower.wheel(240); // two of the follower's lines
    follower.jumpToPos(40);
    expect(forwarded).toEqual([
      { type: 'toggle' },
      { type: 'pause' },
      { type: 'scrollBy', lines: 2 },
      { type: 'seekPos', pos: 40 },
    ]);
    host.run(3000);
    expect(leader.getPos()).toBeCloseTo(40, 3);
    expect(follower.getPos()).toBeCloseTo(40, 1);
  });

  it('turns drags and flings into line scrolling', () => {
    const { follower, forwarded } = pair();
    follower.dragStart();
    follower.dragMove(60);
    follower.dragEnd(1000);
    expect(forwarded).toEqual([
      { type: 'scrollBy', lines: 0.5 },
      { type: 'scrollBy', lines: (1000 * 0.325) / 120 },
    ]);
  });

  it('shows large jumps immediately', () => {
    const { host, leader, follower } = pair();
    leader.dispatch({ type: 'toEnd' });
    host.run(3000);
    expect(follower.getPos()).toBeGreaterThan(490);
    leader.reset();
    host.step(16);
    expect(follower.getPx()).toBe(0);
  });

  it('mirrors the countdown and elapsed time', () => {
    const { host, leader, follower } = pair({ countdownSec: 3 });
    leader.startPlay();
    host.run(100);
    expect(follower.getStatus().countdown).toBe(3);
    host.run(4000);
    expect(follower.getStatus().play).toBe('playing');
    expect(follower.getStatus().elapsedMs).toBeGreaterThan(900);
  });

  it('scrolls by lines on the leader', () => {
    const host = new FakeHost();
    const engine = makeEngine(host, LEADER);
    engine.dispatch({ type: 'scrollBy', lines: 2 });
    host.run(2000);
    expect(engine.getPx()).toBeCloseTo(120, 3);
  });
});

describe('ScrollEngine handover', () => {
  it('takes over playback without losing the position', () => {
    const { host, leader, follower, unlink } = pair();
    leader.startPlay();
    host.run(3000);
    unlink();
    const snap = leader.exportSnapshot();
    follower.lead(snap);
    leader.follow(snap);
    expect(follower.getMode()).toBe('lead');
    expect(follower.getStatus().play).toBe('playing');
    expect(follower.getPos()).toBeCloseTo(snap.pos, 1);
    host.run(1000);
    expect(follower.getPos()).toBeCloseTo(snap.pos + 2, 1);
    expect(follower.exportSnapshot().elapsedMs).toBeCloseTo(snap.elapsedMs + 1000, -2);
  });

  it('continues from the last snapshot when taking over on its own', () => {
    const { host, leader, follower, unlink } = pair();
    leader.startPlay();
    host.run(2000);
    unlink();
    const pos = leader.getPos();
    follower.lead(null, { pause: true });
    expect(follower.getStatus().play).toBe('paused');
    expect(follower.getPos()).toBeCloseTo(pos, 0);
    host.run(1000);
    expect(follower.getPos()).toBeCloseTo(pos, 0);
  });

  it('does not stop again at a cue the leader already stopped at', () => {
    const { host, leader, follower, unlink } = pair({}, { ...LEADER, cueLines: [5] });
    leader.startPlay();
    host.run(20_000);
    expect(leader.getStatus().play).toBe('paused'); // at the cue on line 5 (token 25)
    unlink();
    follower.lead(leader.exportSnapshot());
    follower.startPlay();
    host.run(3000);
    expect(follower.getStatus().play).toBe('playing');
    expect(follower.getPos()).toBeGreaterThan(29);
  });

  it('keeps the play state when halted', () => {
    const host = new FakeHost();
    const engine = makeEngine(host, LEADER);
    engine.startPlay();
    host.run(1000);
    engine.halt();
    expect(host.pending).toBe(0);
    expect(engine.getStatus().play).toBe('playing');
    engine.relayout();
    host.run(1000);
    expect(engine.getPos()).toBeGreaterThan(3);
  });
});
