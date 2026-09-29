import { z } from 'zod';
import { EngineCommandSchema } from '../commands/schema';
import type { EngineSnapshot } from '../engine/types';

/** Operator windows run the show; display windows are what the talent reads (e.g. on the glass). */
export type SyncRole = 'operator' | 'display';

const id = z.string().min(1).max(64);
const term = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const ms = z.number().min(0).max(1e10);

export const EngineSnapshotSchema = z.object({
  play: z.enum(['idle', 'countdown', 'playing', 'paused', 'ended']),
  holding: z.boolean(),
  moving: z.boolean(),
  pos: z.number().min(0).max(10_000_000),
  seekPos: z.number().min(0).max(10_000_000).nullable(),
  wpm: z.number().min(0).max(100_000),
  elapsedMs: ms,
  remainingMs: ms,
  countdownMs: ms.nullable(),
  holdMs: ms.nullable(),
  gate: z.boolean(),
  voiceWord: z.number().int().min(-1).max(10_000_000),
});

type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
const snapshotMatches: Same<z.infer<typeof EngineSnapshotSchema>, EngineSnapshot> = true;
void snapshotMatches;

/**
 * Messages between the windows of one prompter session (a BroadcastChannel per session):
 *
 * - `hello`: presence heartbeat — who I am, which script I show, whether I am visible.
 * - `state`: the leader's playback snapshot (on every change, ~10/s while scrolling, 1/s idle).
 * - `cmd`: a follower asks the leader to do something (play, seek…).
 * - `handoff`: the leader passes playback to another window.
 * - `bye`: the window is closing.
 */
export const SyncMessageSchema = z.discriminatedUnion('k', [
  z.object({
    k: z.literal('hello'),
    id,
    role: z.enum(['operator', 'display']),
    visible: z.boolean(),
    since: z.number(),
    script: id,
  }),
  z.object({ k: z.literal('state'), id, term, script: id, snap: EngineSnapshotSchema }),
  z.object({ k: z.literal('cmd'), id, to: id, cmd: EngineCommandSchema }),
  z.object({
    k: z.literal('handoff'),
    id,
    to: id,
    term,
    script: id,
    snap: EngineSnapshotSchema,
    pause: z.boolean(),
  }),
  z.object({ k: z.literal('bye'), id }),
]);

export type SyncMessage = z.infer<typeof SyncMessageSchema>;
