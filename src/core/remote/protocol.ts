import { z } from 'zod';
import { CommandSchema } from '../commands/schema';
import type { Command } from '../commands/types';

/** Phone ⇄ prompter messages travel as JSON strings over a WebRTC data channel (PeerJS). */
export const PROTOCOL_VERSION = 1;
/** Anything a phone sends is small; bigger messages are dropped unread. */
export const MAX_PHONE_MESSAGE = 2048;
export const MAX_HOST_MESSAGE = 64 * 1024;
export const MAX_DEVICES = 3;
export const MAX_PENDING = 5;
export const AUTH_TIMEOUT_MS = 5000;
/** Messages per second a phone may send (a token bucket allows short bursts). */
export const PHONE_RATE = 30;
export const PING_INTERVAL_MS = 4000;
/** A connection without any message for this long is considered dead. */
export const SILENCE_TIMEOUT_MS = 15_000;

export const PhoneMessageSchema = z.discriminatedUnion('t', [
  z.object({
    t: z.literal('auth'),
    v: z.literal(PROTOCOL_VERSION),
    key: z.string().min(16).max(64),
    name: z.string().max(40),
  }),
  z.object({ t: z.literal('cmd'), cmd: CommandSchema }),
  z.object({ t: z.literal('ping') }),
]);
export type PhoneMessage = z.infer<typeof PhoneMessageSchema>;

export const RemoteStateSchema = z.object({
  play: z.enum(['idle', 'countdown', 'playing', 'paused', 'ended']),
  holding: z.boolean(),
  progress: z.number().min(0).max(1),
  /** Effective words per minute. */
  wpm: z.number().min(0).max(100_000),
  elapsedMs: z.number().min(0).max(1e10),
  remainingMs: z.number().min(0).max(1e10),
  marker: z.number().int().min(-1).max(100_000),
  countdown: z.number().int().min(0).max(60).nullable(),
  fontSize: z.number().min(0).max(1000),
  mirrorH: z.boolean(),
  mirrorV: z.boolean(),
  /** Whether the phone may change the text size and mirroring. */
  canChangeLook: z.boolean(),
});
export type RemoteState = z.infer<typeof RemoteStateSchema>;

export const ScriptInfoSchema = z.object({
  title: z.string().max(200),
  dir: z.enum(['rtl', 'ltr']),
  markers: z.array(z.object({ title: z.string().max(120), level: z.number().int().min(1).max(3) })).max(500),
});
export type ScriptInfo = z.infer<typeof ScriptInfoSchema>;

export const HostMessageSchema = z.discriminatedUnion('t', [
  z.object({ t: z.literal('welcome'), v: z.literal(PROTOCOL_VERSION), script: ScriptInfoSchema.nullable() }),
  z.object({ t: z.literal('state'), s: RemoteStateSchema }),
  z.object({ t: z.literal('denied'), reason: z.enum(['key', 'full', 'timeout', 'version']) }),
  z.object({ t: z.literal('pong') }),
]);
export type HostMessage = z.infer<typeof HostMessageSchema>;

function parse<T>(schema: z.ZodType<T>, data: unknown, maxLength: number): T | null {
  if (typeof data !== 'string' || data.length > maxLength) return null;
  let json: unknown;
  try {
    json = JSON.parse(data);
  } catch {
    return null;
  }
  const result = schema.safeParse(json);
  return result.success ? result.data : null;
}

export const parsePhoneMessage = (data: unknown) => parse(PhoneMessageSchema, data, MAX_PHONE_MESSAGE);
export const parseHostMessage = (data: unknown) => parse(HostMessageSchema, data, MAX_HOST_MESSAGE);

const LOOK_COMMANDS = new Set<Command['type']>(['nudgeFontSize', 'toggleMirror', 'toggleHud', 'toggleGuide']);
const PLAYBACK_COMMANDS = new Set<Command['type']>([
  'play',
  'pause',
  'toggle',
  'reset',
  'toStart',
  'toEnd',
  'setWpm',
  'nudgeWpm',
  'nudgeLines',
  'nudgePages',
  'jumpBlock',
  'jumpMarker',
  'gotoMarker',
  'seekPos',
  'seekProgress',
]);

/** What a phone may do: playback always, the look only when allowed. Never exit, full screen… */
export function isRemoteCommandAllowed(command: Command, canChangeLook: boolean): boolean {
  return PLAYBACK_COMMANDS.has(command.type) || (canChangeLook && LOOK_COMMANDS.has(command.type));
}
