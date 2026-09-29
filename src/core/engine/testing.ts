import type { EngineHost, EngineSurface, LayoutModel } from './types';

/** Deterministic clock + requestAnimationFrame for engine tests. */
export class FakeHost implements EngineHost {
  time = 0;
  private queue = new Map<number, (time: number) => void>();
  private nextId = 1;

  now(): number {
    return this.time;
  }

  raf(callback: (time: number) => void): number {
    const id = this.nextId++;
    this.queue.set(id, callback);
    return id;
  }

  caf(id: number): void {
    this.queue.delete(id);
  }

  get pending(): number {
    return this.queue.size;
  }

  /** Advances time by `ms` and runs the frame callbacks that were queued. */
  step(ms: number): void {
    this.time += ms;
    const callbacks = [...this.queue.values()];
    this.queue.clear();
    for (const callback of callbacks) callback(this.time);
  }

  /** Runs frames at `hz` for `ms` of simulated time. */
  run(ms: number, hz = 60): void {
    const frame = 1000 / hz;
    const end = this.time + ms;
    while (this.time < end - 1e-9) this.step(Math.min(frame, end - this.time));
  }
}

export interface ModelSpec {
  lines?: number;
  tokensPerLine?: number;
  lineHeight?: number;
  viewportH?: number;
  readingY?: number;
  dpr?: number;
  /** Line indices where blocks start. */
  blockLines?: number[];
  markerLines?: number[];
  cueLines?: number[];
}

/** A synthetic layout: `lines` lines of `tokensPerLine` tokens, `lineHeight` px apart. */
export function makeModel(spec: ModelSpec = {}): LayoutModel {
  const {
    lines = 100,
    tokensPerLine = 5,
    lineHeight = 60,
    viewportH = 900,
    readingY = 300,
    dpr = 1,
    blockLines = [0],
    markerLines = [],
    cueLines = [],
  } = spec;
  const lineP = Float64Array.from({ length: lines }, (_, k) => k * lineHeight);
  const lineTok = Int32Array.from({ length: lines }, (_, k) => k * tokensPerLine);
  const at = (indices: number[]) => Float64Array.from(indices, (k) => k * lineHeight);
  return {
    viewportH,
    readingY,
    dpr,
    lineHeightPx: lineHeight,
    tokenCount: lines * tokensPerLine,
    lineP,
    lineTok,
    blockP: at(blockLines),
    markerP: at(markerLines),
    cueP: at(cueLines),
    paraHeight: lines * lineHeight,
    headingHeight: 0,
    endPx: (lines - 1) * lineHeight,
    scrollOutPx: lines * lineHeight + readingY,
  };
}

export class FakeSurface implements EngineSurface {
  applied: number[] = [];
  model: LayoutModel;
  constructor(model: LayoutModel) {
    this.model = model;
  }
  measure(): LayoutModel {
    return this.model;
  }
  apply(px: number): void {
    this.applied.push(px);
  }
  get last(): number {
    return this.applied[this.applied.length - 1] ?? Number.NaN;
  }
}
