import type { EngineCommand } from '../commands/types';
import { EMPTY_MODEL, lastIndexAtOrBelow, posToPx, pxToPos, snapToDevicePixels } from './layout';
import { autoVelocity, clampWpm, effectiveWpm } from './speed';
import type {
  EngineConfig,
  EngineHost,
  EngineMode,
  EngineSnapshot,
  EngineStatus,
  EngineSurface,
  LayoutModel,
  PlayState,
} from './types';

interface Spring {
  target: number;
  vel: number;
  omega: number;
}

/** The latest state received from the leading window (follow mode). */
interface Follower {
  snap: EngineSnapshot;
  /** Host time the snapshot arrived. */
  t: number;
  /** Scroll velocity when it arrived, used to extrapolate it. */
  v0: number;
  /** Velocity of the smoothing spring. */
  vel: number;
  settled: boolean;
}

const STATUS_INTERVAL_MS = 100;
const FLING_DECAY_S = 0.325;
const LOOP_PAUSE_MS = 1000;
/** Angular frequencies of the critically damped spring (higher = snappier). */
export const SPRING = { seek: 9, wheel: 12, follow: 6, voice: 3.5 } as const;
/** A follower never extrapolates the leader's motion further than this. */
const MAX_EXTRAPOLATION_MS = 250;

export const DEFAULT_ENGINE_CONFIG: EngineConfig = {
  wpm: 120,
  rampMs: 600,
  countdownSec: 3,
  endBehavior: 'stop',
  autoPauseOnCues: true,
  pauseAtMarkers: false,
  headingsSpoken: false,
  targetDurationSec: null,
  spokenWords: 0,
  cueSeconds: [],
};

export const browserHost: EngineHost = {
  now: () => performance.now(),
  raf: (callback) => requestAnimationFrame(callback),
  caf: (id) => cancelAnimationFrame(id),
};

/**
 * Framework-independent teleprompter scroll engine.
 *
 * It advances the scroll offset with requestAnimationFrame using real elapsed time (so 60/120/144 Hz
 * displays scroll identically), ramps speed changes smoothly, animates jumps with a critically
 * damped spring, pauses on cues, and writes the offset straight to the DOM through `surface.apply`
 * — React never re-renders per frame. The loop stops whenever nothing moves.
 *
 * In follow mode the engine mirrors another window instead: it extrapolates the leader's snapshots
 * in its own layout, smooths corrections with a spring and forwards local input to the leader.
 */
export class ScrollEngine {
  private model: LayoutModel = EMPTY_MODEL;
  private config: EngineConfig;
  private px = 0;
  private v = 0;
  private play: PlayState = 'idle';
  private spring: Spring | null = null;
  private fling = 0;
  private dragging = false;
  private countdownEnd: number | null = null;
  private holdUntil: number | null = null;
  private loopAt: number | null = null;
  private readonly consumedCues = new Set<number>();
  private readonly consumedMarkers = new Set<number>();
  private elapsedMs = 0;
  private lastFrame: number | null = null;
  private rafId: number | null = null;
  private appliedPx = Number.NaN;
  private status: EngineStatus;
  private statusDirty = false;
  private lastEmit = Number.NEGATIVE_INFINITY;
  private readonly listeners = new Set<() => void>();
  private readonly frameListeners = new Set<(px: number, pos: number) => void>();
  private destroyed = false;
  private mode: EngineMode = 'lead';
  /** Voice activity gate (closed: hold while the talent is silent). */
  private gate = true;
  private voiceWord = -1;
  private follower: Follower | null = null;
  private forward: ((command: EngineCommand) => void) | null = null;
  private readonly host: EngineHost;
  private readonly surface: EngineSurface;

  constructor(host: EngineHost, surface: EngineSurface, config: Partial<EngineConfig> = {}) {
    this.host = host;
    this.surface = surface;
    this.config = { ...DEFAULT_ENGINE_CONFIG, ...config };
    this.status = this.snapshot(host.now());
  }

  // ── Subscriptions ────────────────────────────────────────────────────────────

  /** useSyncExternalStore-compatible subscription to throttled status snapshots. */
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getStatus = (): EngineStatus => this.status;

  /** Called on every rendered frame (for progress bars etc. that update the DOM directly). */
  onFrame(listener: (px: number, pos: number) => void): () => void {
    this.frameListeners.add(listener);
    return () => this.frameListeners.delete(listener);
  }

  // ── Configuration & layout ──────────────────────────────────────────────────

  setConfig(config: Partial<EngineConfig>): void {
    this.config = { ...this.config, ...config, wpm: clampWpm(config.wpm ?? this.config.wpm) };
    if (config.endBehavior && this.px > this.maxPx()) this.px = this.maxPx();
    this.touch();
  }

  getConfig(): Readonly<EngineConfig> {
    return this.config;
  }

  getModel(): Readonly<LayoutModel> {
    return this.model;
  }

  /** Re-measures the layout while keeping the same words on the reading line. */
  relayout(): void {
    if (this.destroyed) return;
    const pos = pxToPos(this.model, this.px);
    const springPos = this.spring ? pxToPos(this.model, this.spring.target) : null;
    this.model = this.surface.measure();
    this.px = this.clamp(posToPx(this.model, pos));
    if (this.spring && springPos !== null) this.spring.target = this.clamp(posToPx(this.model, springPos));
    this.appliedPx = Number.NaN;
    this.render();
    this.touch();
  }

  // ── Commands ─────────────────────────────────────────────────────────────────

  dispatch(command: EngineCommand): void {
    if (this.mode === 'follow') {
      this.forward?.(command);
      return;
    }
    switch (command.type) {
      case 'play':
        return this.startPlay();
      case 'pause':
        return this.pause();
      case 'toggle':
        return this.play === 'playing' || this.play === 'countdown' ? this.pause() : this.startPlay();
      case 'reset':
        return this.reset();
      case 'toStart':
        return this.seekTo(0);
      case 'toEnd':
        return this.seekTo(this.model.endPx);
      case 'setWpm':
        return this.setConfig({ wpm: command.wpm, targetDurationSec: null });
      case 'nudgeWpm':
        return this.setConfig({ wpm: this.config.wpm + command.steps * 5, targetDurationSec: null });
      case 'nudgeLines':
        return this.seekBy(command.lines * this.model.lineHeightPx);
      case 'nudgePages':
        return this.seekBy(command.pages * this.model.viewportH * 0.8);
      case 'scrollBy':
        return this.wheel(command.lines * this.model.lineHeightPx);
      case 'voiceGate':
        this.gate = command.open;
        return this.touch();
      case 'voiceTrack':
        this.voiceWord = command.word;
        // Speech moves the text only while playing (like the automatic scroll it replaces).
        if (this.play !== 'playing') return this.touch();
        return this.seekTo(
          posToPx(this.model, command.pos) + command.lead * this.model.lineHeightPx,
          SPRING.voice,
        );
      case 'voiceReset':
        this.gate = true;
        this.voiceWord = -1;
        return this.touch();
      case 'jumpBlock':
        return this.jumpAmong(this.model.blockP, command.delta);
      case 'jumpMarker':
        return this.jumpAmong(this.model.markerP, command.delta);
      case 'gotoMarker': {
        const p = this.model.markerP[command.index];
        if (p !== undefined) this.seekTo(p);
        return;
      }
      case 'seekPos':
        return this.seekTo(posToPx(this.model, command.pos));
      case 'seekProgress':
        return this.seekTo(Math.min(1, Math.max(0, command.progress)) * this.maxPx());
    }
  }

  /** Starts (or resumes) playback. From the top or the end it runs the countdown first. */
  startPlay(): void {
    if (this.mode === 'follow') return this.forward?.({ type: 'play' });
    const now = this.host.now();
    if (this.play === 'ended') {
      this.px = 0;
      this.spring = null;
      this.elapsedMs = 0;
      this.consumedCues.clear();
      this.consumedMarkers.clear();
      this.play = 'idle';
    }
    if (this.play === 'playing' || this.play === 'countdown') return;
    this.holdUntil = null;
    if (this.play === 'idle' && this.config.countdownSec > 0) {
      this.play = 'countdown';
      this.countdownEnd = now + this.config.countdownSec * 1000;
    } else {
      this.play = 'playing';
    }
    this.touch();
  }

  pause(): void {
    if (this.mode === 'follow') return this.forward?.({ type: 'pause' });
    this.stopPlayback();
    this.touch();
  }

  private stopPlayback(): void {
    if (this.play === 'countdown') {
      this.play = this.elapsedMs > 0 ? 'paused' : 'idle';
      this.countdownEnd = null;
    } else if (this.play === 'playing') {
      this.play = 'paused';
    } else {
      return;
    }
    this.holdUntil = null;
    this.loopAt = null;
  }

  /** Stops and returns to the top immediately. */
  reset(): void {
    if (this.mode === 'follow') return this.forward?.({ type: 'reset' });
    this.play = 'idle';
    this.px = 0;
    this.v = 0;
    this.spring = null;
    this.fling = 0;
    this.countdownEnd = null;
    this.holdUntil = null;
    this.loopAt = null;
    this.elapsedMs = 0;
    this.consumedCues.clear();
    this.consumedMarkers.clear();
    this.render();
    this.touch();
  }

  /** Animated (spring) or immediate move to offset `target`. */
  seekTo(target: number, omega: number = SPRING.seek, animate = true): void {
    const clamped = this.clamp(target);
    this.fling = 0;
    if (!animate) {
      this.spring = null;
      this.moveTo(clamped, false);
      this.render();
    } else {
      this.spring = { target: clamped, vel: this.spring?.vel ?? 0, omega };
    }
    this.touch();
  }

  seekBy(delta: number, omega: number = SPRING.seek): void {
    const base = this.spring ? this.spring.target : this.px;
    this.seekTo(base + delta, omega);
  }

  /** Mouse-wheel / trackpad scrolling. */
  wheel(deltaPx: number): void {
    if (this.mode === 'follow') return this.forwardScroll(deltaPx);
    const base = this.spring ? this.spring.target : this.px;
    this.fling = 0;
    this.spring = { target: this.clamp(base + deltaPx), vel: this.spring?.vel ?? 0, omega: SPRING.wheel };
    this.touch(false);
  }

  dragStart(): void {
    if (this.mode === 'follow') return;
    this.dragging = true;
    this.spring = null;
    this.fling = 0;
    this.touch();
  }

  dragMove(deltaPx: number): void {
    if (this.mode === 'follow') return this.forwardScroll(deltaPx);
    if (!this.dragging) return;
    this.moveTo(this.clamp(this.px + deltaPx), false);
    this.render();
    this.touch(false);
  }

  /** Ends a drag, continuing with an exponentially decaying fling. */
  dragEnd(velocityPxPerSec = 0): void {
    // A fling travels velocity × decay time in total.
    if (this.mode === 'follow') return this.forwardScroll(velocityPxPerSec * FLING_DECAY_S);
    if (!this.dragging) return;
    this.dragging = false;
    this.fling = Math.max(-6000, Math.min(6000, velocityPxPerSec));
    this.touch();
  }

  /** Moves to a token position immediately (e.g. to resume where the reader left off). */
  jumpToPos(pos: number): void {
    if (this.mode === 'follow') return this.forward?.({ type: 'seekPos', pos });
    this.seekTo(posToPx(this.model, pos), SPRING.seek, false);
  }

  /** Current continuous token position at the reading line. */
  getPos(): number {
    return pxToPos(this.model, this.px);
  }

  getPx(): number {
    return this.px;
  }

  /**
   * Stops all motion and the frame loop without destroying the engine or changing the play state
   * (used when the view unmounts; any later command or relayout restarts it).
   */
  halt(): void {
    this.v = 0;
    this.spring = null;
    this.fling = 0;
    this.dragging = false;
    if (this.rafId !== null) this.host.caf(this.rafId);
    this.rafId = null;
    this.lastFrame = null;
  }

  // ── Multi-window ─────────────────────────────────────────────────────────────

  getMode(): EngineMode {
    return this.mode;
  }

  /** Where commands and scrolling go while following another window. */
  setForwarder(forward: ((command: EngineCommand) => void) | null): void {
    this.forward = forward;
  }

  /** Layout-independent playback state (while following: the leader's, extrapolated to now). */
  exportSnapshot(): EngineSnapshot {
    const now = this.host.now();
    if (this.mode === 'follow' && this.follower) return this.extrapolate(this.follower, now);
    const max = this.maxPx();
    const velocity = autoVelocity(this.model, this.config, max);
    return {
      play: this.play,
      holding: this.holdUntil !== null,
      moving: this.isAdvancing(),
      pos: pxToPos(this.model, this.px),
      seekPos: this.spring ? pxToPos(this.model, this.spring.target) : null,
      wpm: Math.round(effectiveWpm(velocity, this.model, this.config)),
      elapsedMs: this.elapsedMs,
      remainingMs: this.remainingMs(now, velocity, max),
      countdownMs: this.countdownEnd !== null ? Math.max(0, this.countdownEnd - now) : null,
      holdMs: this.holdUntil !== null ? Math.max(0, this.holdUntil - now) : null,
      gate: this.gate,
      voiceWord: this.voiceWord,
    };
  }

  /**
   * Mirrors the window that leads playback. Call it with every snapshot received from the leader;
   * the engine extrapolates between them and smooths corrections.
   */
  follow(snap: EngineSnapshot): void {
    if (this.destroyed) return;
    const now = this.host.now();
    if (this.mode === 'lead') {
      this.mode = 'follow';
      this.spring = null;
      this.fling = 0;
      this.dragging = false;
      this.countdownEnd = null;
      this.holdUntil = null;
      this.loopAt = null;
    }
    const target = this.clamp(posToPx(this.model, snap.pos));
    const first = this.follower === null;
    this.follower = { snap, t: now, v0: this.v, vel: this.follower?.vel ?? 0, settled: false };
    // Large jumps (a reset, a jump far away, the first snapshot) are shown immediately.
    if (first || Math.abs(target - this.px) > Math.max(this.model.viewportH, 1) * 1.5) {
      this.px = target;
      this.follower.vel = 0;
      this.render();
    }
    this.touch();
  }

  /**
   * Takes over playback, continuing from `snap` (another window's state) or, when following, from
   * the last state received. `pause` stops playback at the handed-over position.
   */
  lead(snap: EngineSnapshot | null = null, options: { pause?: boolean } = {}): void {
    if (this.destroyed) return;
    const now = this.host.now();
    const wasFollowing = this.mode === 'follow';
    const source = snap ?? (this.follower ? this.extrapolate(this.follower, now) : null);
    this.mode = 'lead';
    this.follower = null;
    if (source) this.adopt(source, now, wasFollowing);
    if (options.pause) this.stopPlayback();
    this.touch();
  }

  private adopt(snap: EngineSnapshot, now: number, wasFollowing: boolean): void {
    const target = this.clamp(posToPx(this.model, snap.pos));
    // A follower is already (almost) there: keep its offset to avoid a visible jump.
    if (!wasFollowing || Math.abs(target - this.px) > this.model.lineHeightPx) this.px = target;
    this.play = snap.play;
    this.elapsedMs = snap.elapsedMs;
    this.countdownEnd =
      snap.play === 'countdown' ? now + (snap.countdownMs ?? this.config.countdownSec * 1000) : null;
    this.holdUntil = snap.holding ? now + (snap.holdMs ?? 0) : null;
    this.loopAt = null;
    this.gate = snap.gate;
    this.voiceWord = snap.voiceWord;
    this.fling = 0;
    this.dragging = false;
    this.spring =
      snap.seekPos !== null
        ? { target: this.clamp(posToPx(this.model, snap.seekPos)), vel: 0, omega: SPRING.seek }
        : null;
    if (!wasFollowing) this.v = snap.moving ? autoVelocity(this.model, this.config, this.maxPx()) : 0;
    // Cues and markers the leader already passed (with some slack for layout differences).
    const passed = this.px + this.model.lineHeightPx * 0.75;
    this.consumedCues.clear();
    this.consumedMarkers.clear();
    this.model.cueP.forEach((p, i) => p <= passed && this.consumedCues.add(i));
    this.model.markerP.forEach((p, i) => p <= passed && this.consumedMarkers.add(i));
    this.appliedPx = Number.NaN;
    this.render();
  }

  /** The leader's snapshot moved forward to `now` (bounded). */
  private extrapolate(follower: Follower, now: number): EngineSnapshot {
    const { snap } = follower;
    const age = Math.max(0, now - follower.t);
    const moved = snap.moving ? Math.min(age, MAX_EXTRAPOLATION_MS) : 0;
    const pos = snap.moving
      ? pxToPos(this.model, posToPx(this.model, snap.pos) + (follower.v0 * moved) / 1000)
      : snap.pos;
    return {
      ...snap,
      pos,
      elapsedMs: snap.elapsedMs + (snap.play === 'playing' ? age : 0),
      remainingMs: Math.max(0, snap.remainingMs - (snap.moving ? age : 0)),
      countdownMs: snap.countdownMs !== null ? Math.max(0, snap.countdownMs - age) : null,
      holdMs: snap.holdMs !== null ? Math.max(0, snap.holdMs - age) : null,
    };
  }

  private forwardScroll(deltaPx: number): void {
    if (deltaPx === 0) return;
    this.forward?.({ type: 'scrollBy', lines: deltaPx / Math.max(this.model.lineHeightPx, 1) });
  }

  destroy(): void {
    this.destroyed = true;
    if (this.rafId !== null) this.host.caf(this.rafId);
    this.rafId = null;
    this.listeners.clear();
    this.frameListeners.clear();
  }

  // ── Frame loop ───────────────────────────────────────────────────────────────

  private readonly frame = (): void => {
    this.rafId = null;
    if (this.destroyed) return;
    const now = this.host.now();
    const dt = this.lastFrame === null ? 0 : Math.min(now - this.lastFrame, 100) / 1000;
    this.lastFrame = now;

    if (this.mode === 'follow') this.followStep(now, dt);
    else this.leadStep(now, dt);

    this.render();
    if (this.statusDirty || now - this.lastEmit >= STATUS_INTERVAL_MS) this.emit(now);

    if (this.needsFrame()) {
      this.schedule();
    } else {
      this.lastFrame = null;
      this.emit(now);
    }
  };

  /** Speed ramps exponentially toward the target (τ = rampMs / 3). */
  private ramp(vTarget: number, dt: number): void {
    const tau = Math.max(this.config.rampMs, 1) / 3000;
    this.v += (vTarget - this.v) * (1 - Math.exp(-dt / tau));
    if (vTarget === 0 && Math.abs(this.v) < 0.5) this.v = 0;
  }

  private isAdvancing(): boolean {
    return (
      this.play === 'playing' &&
      this.holdUntil === null &&
      this.loopAt === null &&
      !this.dragging &&
      this.gate
    );
  }

  private followStep(now: number, dt: number): void {
    const f = this.follower;
    if (!f) return;
    const age = Math.max(0, now - f.t);
    // Keep scrolling with the leader, but coast to a stop when its snapshots stop coming.
    const fresh = f.snap.moving && age <= MAX_EXTRAPOLATION_MS * 2;
    this.ramp(fresh ? autoVelocity(this.model, this.config, this.maxPx()) : 0, dt);
    const ahead = f.snap.moving ? (f.v0 * Math.min(age, MAX_EXTRAPOLATION_MS)) / 1000 : 0;
    const target = this.clamp(posToPx(this.model, f.snap.pos) + ahead);
    // Critically damped spring toward the extrapolated target, in a frame moving with the scroll.
    const w = SPRING.follow;
    const x = this.px + this.v * dt - target;
    const e = Math.exp(-w * dt);
    const nx = (x + (f.vel + w * x) * dt) * e;
    f.vel = (f.vel - w * (f.vel + w * x) * dt) * e;
    if (Math.abs(nx) < 0.3 && Math.abs(f.vel) < 3) {
      this.px = target;
      f.vel = 0;
      f.settled = true;
    } else {
      this.px = this.clamp(target + nx);
      f.settled = false;
    }
  }

  private leadStep(now: number, dt: number): void {
    if (this.play === 'countdown' && this.countdownEnd !== null && now >= this.countdownEnd) {
      this.play = 'playing';
      this.countdownEnd = null;
      this.statusDirty = true;
    }
    if (this.holdUntil !== null && now >= this.holdUntil) {
      this.holdUntil = null;
      this.statusDirty = true;
    }
    if (this.loopAt !== null && now >= this.loopAt) {
      this.loopAt = null;
      this.spring = null;
      this.px = 0;
      this.consumedCues.clear();
      this.consumedMarkers.clear();
      this.statusDirty = true;
    }

    const playing = this.play === 'playing';
    const advancing = this.isAdvancing();
    this.ramp(advancing ? autoVelocity(this.model, this.config, this.maxPx()) : 0, dt);

    const prev = this.px;
    let natural = true;
    if (this.spring) {
      natural = false;
      const s = this.spring;
      // The spring works in a frame that moves with the automatic scroll, so a seek during playback
      // settles exactly on target instead of trailing it.
      const x = this.px - s.target;
      s.target = this.clamp(s.target + this.v * dt);
      const e = Math.exp(-s.omega * dt);
      const nx = (x + (s.vel + s.omega * x) * dt) * e;
      s.vel = (s.vel - s.omega * (s.vel + s.omega * x) * dt) * e;
      if (Math.abs(nx) < 0.5 && Math.abs(s.vel) < 5) {
        this.px = s.target;
        this.spring = null;
      } else {
        this.px = s.target + nx;
      }
    } else if (!this.dragging) {
      this.px += this.v * dt;
      if (this.fling !== 0) {
        natural = false;
        this.px += this.fling * dt;
        this.fling *= Math.exp(-dt / FLING_DECAY_S);
        if (Math.abs(this.fling) < 10) this.fling = 0;
      }
    }

    const max = this.maxPx();
    if (this.px < 0 || this.px > max) {
      this.px = this.clamp(this.px);
      this.fling = 0;
    }
    if (playing && dt > 0) this.elapsedMs += dt * 1000;

    this.passCues(prev, this.px, natural && advancing, now);

    if (this.play === 'playing' && this.holdUntil === null && this.loopAt === null && this.px >= max - 0.5) {
      this.reachEnd(now);
    }
  }

  private needsFrame(): boolean {
    if (this.mode === 'follow') {
      const f = this.follower;
      return f !== null && (f.snap.moving || this.v !== 0 || !f.settled);
    }
    return (
      this.play === 'playing' ||
      this.play === 'countdown' ||
      this.v !== 0 ||
      this.spring !== null ||
      this.fling !== 0 ||
      this.loopAt !== null
    );
  }

  private schedule(): void {
    if (this.rafId === null && !this.destroyed) this.rafId = this.host.raf(this.frame);
  }

  /**
   * Publishes the new state (immediately for discrete changes, on the next frame for high-rate input
   * such as wheel and drag) and makes sure the loop runs if something needs animating.
   */
  private touch(emitNow = true): void {
    this.statusDirty = true;
    if (emitNow || !this.needsFrame()) this.emit(this.host.now());
    if (this.needsFrame()) this.schedule();
  }

  private emit(now: number): void {
    this.status = this.snapshot(now);
    this.statusDirty = false;
    this.lastEmit = now;
    for (const listener of this.listeners) listener();
  }

  private remainingMs(now: number, velocity: number, max: number): number {
    let remainingMs = velocity > 0 ? (Math.max(0, max - this.px) / velocity) * 1000 : 0;
    if (this.config.autoPauseOnCues) {
      this.model.cueP.forEach((p, i) => {
        const seconds = this.config.cueSeconds[i];
        if (seconds && p > this.px && !this.consumedCues.has(i)) remainingMs += seconds * 1000;
      });
    }
    if (this.holdUntil !== null) remainingMs += Math.max(0, this.holdUntil - now);
    return remainingMs;
  }

  private snapshot(now: number): EngineStatus {
    const max = this.maxPx();
    const pos = pxToPos(this.model, this.px);
    const progress = max > 0 ? Math.min(1, this.px / max) : 0;
    const marker = lastIndexAtOrBelow(this.model.markerP, this.px + this.model.lineHeightPx / 2);
    if (this.mode === 'follow' && this.follower) {
      const leader = this.extrapolate(this.follower, now);
      return {
        play: leader.play,
        holding: leader.holding,
        pos,
        progress,
        wpm: leader.wpm,
        elapsedMs: leader.elapsedMs,
        remainingMs: leader.remainingMs,
        marker,
        countdown: leader.countdownMs !== null ? Math.max(1, Math.ceil(leader.countdownMs / 1000)) : null,
        voiceWord: leader.voiceWord,
        t: now,
      };
    }
    const velocity = autoVelocity(this.model, this.config, max);
    return {
      play: this.play,
      holding: this.holdUntil !== null,
      pos,
      progress,
      wpm: Math.round(effectiveWpm(velocity, this.model, this.config)),
      elapsedMs: this.elapsedMs,
      remainingMs: this.remainingMs(now, velocity, max),
      marker,
      countdown: this.countdownEnd !== null ? Math.max(1, Math.ceil((this.countdownEnd - now) / 1000)) : null,
      voiceWord: this.voiceWord,
      t: now,
    };
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  private maxPx(): number {
    return this.config.endBehavior === 'scrollOut' ? this.model.scrollOutPx : this.model.endPx;
  }

  private clamp(px: number): number {
    return Math.min(Math.max(px, 0), Math.max(this.maxPx(), 0));
  }

  /** Moves without animation; cues passed this way are consumed silently. */
  private moveTo(px: number, natural: boolean): void {
    const prev = this.px;
    this.px = px;
    this.passCues(prev, px, natural, this.host.now());
  }

  private render(): void {
    const snapped = snapToDevicePixels(this.px, this.model.dpr);
    if (snapped !== this.appliedPx) {
      this.appliedPx = snapped;
      this.surface.apply(snapped);
    }
    if (this.frameListeners.size) {
      const pos = pxToPos(this.model, this.px);
      for (const listener of this.frameListeners) listener(this.px, pos);
    }
  }

  /**
   * Handles cues and markers between `prev` and `px`. Only natural playback triggers pauses; seeks,
   * drags and flings consume the cues they skip. Moving back above a cue re-arms it.
   */
  private passCues(prev: number, px: number, natural: boolean, now: number): void {
    const hysteresis = this.model.lineHeightPx;
    if (px > prev) {
      const cues = this.model.cueP;
      for (let i = 0; i < cues.length; i++) {
        const p = cues[i]!;
        if (prev < p && p <= px && !this.consumedCues.has(i)) {
          this.consumedCues.add(i);
          if (natural && this.config.autoPauseOnCues && this.play === 'playing') {
            const seconds = this.config.cueSeconds[i];
            if (seconds) this.holdUntil = now + seconds * 1000;
            else this.play = 'paused';
            this.statusDirty = true;
          }
        }
      }
      const markers = this.model.markerP;
      for (let i = 0; i < markers.length; i++) {
        const p = markers[i]!;
        if (prev < p && p <= px && !this.consumedMarkers.has(i)) {
          this.consumedMarkers.add(i);
          if (natural && this.config.pauseAtMarkers && this.play === 'playing' && p > 0) {
            this.play = 'paused';
            this.statusDirty = true;
          }
        }
      }
    } else if (px < prev) {
      for (const i of this.consumedCues)
        if ((this.model.cueP[i] ?? 0) > px + hysteresis) this.consumedCues.delete(i);
      for (const i of this.consumedMarkers) {
        if ((this.model.markerP[i] ?? 0) > px + hysteresis) this.consumedMarkers.delete(i);
      }
    }
  }

  private reachEnd(now: number): void {
    this.px = this.maxPx();
    if (this.config.endBehavior === 'loop') {
      this.loopAt = now + LOOP_PAUSE_MS;
    } else {
      this.play = 'ended';
      this.v = 0;
    }
    this.statusDirty = true;
  }

  private jumpAmong(positions: Float64Array, delta: -1 | 1): void {
    const base = this.spring ? this.spring.target : this.px;
    const epsilon = Math.max(2, this.model.lineHeightPx * 0.25);
    if (delta > 0) {
      for (const p of positions) {
        if (p > base + epsilon) return this.seekTo(p);
      }
      this.seekTo(this.model.endPx);
    } else {
      for (let i = positions.length - 1; i >= 0; i--) {
        const p = positions[i]!;
        if (p < base - epsilon) return this.seekTo(p);
      }
      this.seekTo(0);
    }
  }
}
