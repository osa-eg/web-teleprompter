import { describe, expect, it } from 'vitest';
import { ScrollEngine } from './ScrollEngine';
import { FakeHost, FakeSurface, makeModel, type ModelSpec } from './testing';
import type { EngineConfig } from './types';

// 100 lines × 5 words, 60 px per line → 12 px per word. At 120 wpm (2 words/s): 24 px/s.
const SPEED = 24;

function setup(config: Partial<EngineConfig> = {}, spec: ModelSpec = {}) {
  const host = new FakeHost();
  const model = makeModel(spec);
  const surface = new FakeSurface(model);
  const engine = new ScrollEngine(host, surface, {
    wpm: 120,
    rampMs: 0,
    countdownSec: 0,
    spokenWords: model.tokenCount,
    ...config,
  });
  engine.relayout();
  return { host, surface, engine, model };
}

describe('ScrollEngine speed', () => {
  it('scrolls at wpm / 60 × px-per-word', () => {
    const { host, engine } = setup();
    engine.startPlay();
    host.run(3000);
    expect(engine.getPx()).toBeCloseTo(3 * SPEED, 0);
    expect(engine.getStatus().wpm).toBe(120);
  });

  it('is frame-rate independent', () => {
    const results = [60, 120, 144].map((hz) => {
      const { host, engine } = setup({ rampMs: 600 });
      engine.startPlay();
      host.run(3000, hz);
      return engine.getPx();
    });
    expect(Math.max(...results) - Math.min(...results)).toBeLessThan(0.5);
  });

  it('ramps smoothly: ~63% of full speed after one time constant', () => {
    const { host, engine } = setup({ rampMs: 600 }); // τ = 200 ms
    engine.startPlay();
    host.step(0);
    host.run(200, 1000);
    const before = engine.getPx();
    host.run(1, 1000);
    const velocity = (engine.getPx() - before) * 1000;
    expect(velocity / SPEED).toBeGreaterThan(0.6);
    expect(velocity / SPEED).toBeLessThan(0.66);
  });

  it('keeps the same pace when the font size changes', () => {
    const { host, engine, surface } = setup();
    engine.startPlay();
    host.run(1000);
    const pos = engine.getPos();
    surface.model = makeModel({ lines: 250, tokensPerLine: 2, lineHeight: 120 });
    engine.relayout();
    expect(engine.getPos()).toBeCloseTo(pos, 6);
    // Words per second stays 2 even though pixels per word changed.
    host.run(1000);
    expect(engine.getPos() - pos).toBeCloseTo(2, 1);
  });

  it('clamps huge frame gaps', () => {
    const { host, engine } = setup();
    engine.startPlay();
    host.step(16);
    host.step(5000);
    expect(engine.getPx()).toBeLessThanOrEqual(0.1 * SPEED + 1e-6);
  });

  it('computes speed from a target duration', () => {
    const { host, engine, model } = setup({ targetDurationSec: 60 });
    engine.startPlay();
    host.run(30_000);
    expect(engine.getPx()).toBeCloseTo(model.endPx / 2, -1);
  });

  it('writes only device-pixel-snapped offsets to the surface', () => {
    const { host, engine, surface } = setup({}, { dpr: 1.25 });
    engine.startPlay();
    host.run(2000);
    for (const px of surface.applied) expect(Math.abs(px * 1.25 - Math.round(px * 1.25))).toBeLessThan(1e-9);
  });
});

describe('ScrollEngine playback states', () => {
  it('counts down before starting from the top', () => {
    const { host, engine } = setup({ countdownSec: 3 });
    engine.startPlay();
    expect(engine.getStatus().play).toBe('countdown');
    host.run(100);
    expect(engine.getStatus().countdown).toBe(3);
    host.run(1000);
    expect(engine.getStatus().countdown).toBe(2);
    host.run(2000);
    expect(engine.getStatus().play).toBe('playing');
    expect(engine.getPx()).toBeLessThan(5);
  });

  it('pauses, resumes without countdown and toggles', () => {
    const { host, engine } = setup({ countdownSec: 3 });
    engine.dispatch({ type: 'toggle' });
    host.run(4000);
    engine.dispatch({ type: 'toggle' });
    expect(engine.getStatus().play).toBe('paused');
    const px = engine.getPx();
    host.run(1000);
    expect(engine.getPx()).toBeCloseTo(px, 6);
    engine.dispatch({ type: 'toggle' });
    expect(engine.getStatus().play).toBe('playing');
  });

  it('stops the animation loop when nothing moves', () => {
    const { host, engine } = setup({ rampMs: 300 });
    engine.startPlay();
    host.run(500);
    engine.pause();
    host.run(2000);
    expect(host.pending).toBe(0);
  });

  it('resets to the top', () => {
    const { host, engine } = setup();
    engine.startPlay();
    host.run(2000);
    engine.dispatch({ type: 'reset' });
    expect(engine.getPx()).toBe(0);
    expect(engine.getStatus()).toMatchObject({ play: 'idle', elapsedMs: 0 });
  });

  it('stops at the end', () => {
    const { host, engine, model } = setup({}, { lines: 3 });
    engine.startPlay();
    host.run(20_000);
    expect(engine.getPx()).toBe(model.endPx);
    expect(engine.getStatus().play).toBe('ended');
    expect(engine.getStatus().progress).toBe(1);
    // Play again restarts from the top.
    engine.startPlay();
    expect(engine.getPx()).toBe(0);
    expect(engine.getStatus().play).toBe('playing');
  });

  it('loops back to the top after a short pause', () => {
    const { host, engine } = setup({ endBehavior: 'loop' }, { lines: 3 });
    engine.startPlay();
    host.run(5000 + 900);
    expect(engine.getStatus().play).toBe('playing');
    host.run(2000);
    expect(engine.getPx()).toBeLessThan(120);
  });

  it('scrolls the text out before ending when asked', () => {
    const { host, engine, model } = setup({ endBehavior: 'scrollOut' }, { lines: 3 });
    engine.startPlay();
    host.run(60_000);
    expect(engine.getPx()).toBe(model.scrollOutPx);
    expect(engine.getStatus().play).toBe('ended');
  });

  it('tracks elapsed and remaining time', () => {
    const { host, engine, model } = setup();
    engine.startPlay();
    host.run(10_000);
    const status = engine.getStatus();
    // Snapshots are throttled to 10 per second, so they may lag the engine by up to 100 ms.
    expect(status.elapsedMs).toBeGreaterThan(9850);
    expect(status.elapsedMs).toBeLessThanOrEqual(10_000);
    const remaining = ((model.endPx - SPEED * (status.elapsedMs / 1000)) / SPEED) * 1000;
    expect(Math.abs(status.remainingMs - remaining)).toBeLessThan(150);
  });
});

describe('ScrollEngine cues and markers', () => {
  it('pauses once at an untimed cue', () => {
    const { host, engine } = setup({ cueSeconds: [undefined] }, { cueLines: [1] });
    engine.startPlay();
    host.run(5000);
    expect(engine.getStatus().play).toBe('paused');
    expect(engine.getPx()).toBeGreaterThanOrEqual(60);
    expect(engine.getPx()).toBeLessThan(70);
    engine.startPlay();
    host.run(3000);
    expect(engine.getStatus().play).toBe('playing');
  });

  it('holds for a timed cue and resumes by itself', () => {
    const { host, engine } = setup({ cueSeconds: [2] }, { cueLines: [1] });
    engine.startPlay();
    host.run(2600);
    expect(engine.getStatus().holding).toBe(true);
    const px = engine.getPx();
    host.run(1000);
    expect(engine.getPx()).toBeCloseTo(px, 3);
    host.run(1500);
    expect(engine.getStatus().holding).toBe(false);
    expect(engine.getPx()).toBeGreaterThan(px + 5);
  });

  it('ignores cues when auto-pause is off', () => {
    const { host, engine } = setup({ autoPauseOnCues: false, cueSeconds: [undefined] }, { cueLines: [1] });
    engine.startPlay();
    host.run(5000);
    expect(engine.getStatus().play).toBe('playing');
  });

  it('consumes cues skipped by a seek and re-arms them when moving back', () => {
    const { host, engine } = setup({ cueSeconds: [undefined] }, { cueLines: [2] });
    engine.seekTo(300);
    host.run(2000);
    engine.startPlay();
    host.run(1000);
    expect(engine.getStatus().play).toBe('playing');
    engine.pause();
    engine.seekTo(0);
    host.run(2000);
    engine.startPlay();
    host.run(6000);
    expect(engine.getStatus().play).toBe('paused');
  });

  it('jumps between markers and reports the current one', () => {
    const { host, engine } = setup({}, { markerLines: [0, 10, 20] });
    engine.dispatch({ type: 'jumpMarker', delta: 1 });
    host.run(2000);
    expect(engine.getPx()).toBeCloseTo(600, 3);
    expect(engine.getStatus().marker).toBe(1);
    engine.dispatch({ type: 'gotoMarker', index: 2 });
    host.run(2000);
    expect(engine.getStatus().marker).toBe(2);
    engine.dispatch({ type: 'jumpMarker', delta: -1 });
    host.run(2000);
    expect(engine.getPx()).toBeCloseTo(600, 3);
  });

  it('jumps between blocks', () => {
    const { host, engine } = setup({}, { blockLines: [0, 4, 9] });
    engine.dispatch({ type: 'jumpBlock', delta: 1 });
    engine.dispatch({ type: 'jumpBlock', delta: 1 });
    host.run(2000);
    expect(engine.getPx()).toBeCloseTo(540, 3);
    engine.dispatch({ type: 'jumpBlock', delta: -1 });
    host.run(2000);
    expect(engine.getPx()).toBeCloseTo(240, 3);
  });

  it('pauses at markers when asked', () => {
    const { host, engine } = setup({ pauseAtMarkers: true }, { markerLines: [0, 2] });
    engine.startPlay();
    host.run(8000);
    expect(engine.getStatus().play).toBe('paused');
    expect(engine.getPx()).toBeGreaterThanOrEqual(120);
  });
});

describe('ScrollEngine manual control', () => {
  it('seeks with a spring and keeps auto-scrolling while playing', () => {
    const { host, engine } = setup();
    engine.startPlay();
    host.run(1000);
    engine.dispatch({ type: 'nudgeLines', lines: 3 });
    host.run(2000);
    expect(engine.getPx()).toBeCloseTo(3 * SPEED + 180, -1);
  });

  it('changes speed by wpm steps', () => {
    const { engine } = setup();
    engine.dispatch({ type: 'nudgeWpm', steps: 2 });
    expect(engine.getConfig().wpm).toBe(130);
    engine.dispatch({ type: 'setWpm', wpm: 9999 });
    expect(engine.getConfig().wpm).toBe(400);
  });

  it('drags 1:1 and flings with decay', () => {
    const { host, engine } = setup();
    engine.dragStart();
    engine.dragMove(100);
    expect(engine.getPx()).toBe(100);
    engine.dragEnd(1000);
    host.run(3000);
    expect(engine.getPx()).toBeGreaterThan(300);
    expect(engine.getPx()).toBeLessThan(450);
  });

  it('never scrolls above the top or past the end', () => {
    const { host, engine, model } = setup({}, { lines: 5 });
    engine.wheel(-500);
    host.run(1000);
    expect(engine.getPx()).toBe(0);
    engine.wheel(10_000);
    host.run(2000);
    expect(engine.getPx()).toBe(model.endPx);
  });

  it('seeks by progress and token position', () => {
    const { host, engine, model } = setup();
    engine.dispatch({ type: 'seekProgress', progress: 0.5 });
    host.run(2000);
    expect(engine.getPx()).toBeCloseTo(model.endPx / 2, 3);
    engine.dispatch({ type: 'seekPos', pos: 50 });
    host.run(2000);
    expect(engine.getPos()).toBeCloseTo(50, 3);
  });

  it('notifies subscribers with stable snapshots', () => {
    const { host, engine } = setup();
    let calls = 0;
    engine.subscribe(() => calls++);
    const before = engine.getStatus();
    expect(engine.getStatus()).toBe(before);
    engine.startPlay();
    host.run(1000);
    expect(calls).toBeGreaterThan(3);
    expect(calls).toBeLessThan(20);
  });
});
