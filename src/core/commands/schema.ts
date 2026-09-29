import { z } from 'zod';
import { MAX_WPM, MIN_WPM } from '../engine/speed';
import type { Command, EngineCommand, ViewCommand } from './types';

// Validation for commands that arrive from other windows and devices: never trust their shape.

const delta = z.union([z.literal(-1), z.literal(1)]);

const ENGINE_OPTIONS = [
  z.object({ type: z.literal('play') }),
  z.object({ type: z.literal('pause') }),
  z.object({ type: z.literal('toggle') }),
  z.object({ type: z.literal('reset') }),
  z.object({ type: z.literal('toStart') }),
  z.object({ type: z.literal('toEnd') }),
  z.object({ type: z.literal('setWpm'), wpm: z.number().min(MIN_WPM).max(MAX_WPM) }),
  z.object({ type: z.literal('nudgeWpm'), steps: z.number().int().min(-20).max(20) }),
  z.object({ type: z.literal('nudgeLines'), lines: z.number().min(-500).max(500) }),
  z.object({ type: z.literal('nudgePages'), pages: z.number().min(-50).max(50) }),
  z.object({ type: z.literal('scrollBy'), lines: z.number().min(-5000).max(5000) }),
  z.object({ type: z.literal('voiceGate'), open: z.boolean() }),
  z.object({
    type: z.literal('voiceTrack'),
    pos: z.number().min(0).max(10_000_000),
    lead: z.number().min(0).max(5),
    word: z.number().int().min(-1).max(10_000_000),
  }),
  z.object({ type: z.literal('voiceReset') }),
  z.object({ type: z.literal('jumpBlock'), delta }),
  z.object({ type: z.literal('jumpMarker'), delta }),
  z.object({ type: z.literal('gotoMarker'), index: z.number().int().min(0).max(100_000) }),
  z.object({ type: z.literal('seekPos'), pos: z.number().min(0).max(10_000_000) }),
  z.object({ type: z.literal('seekProgress'), progress: z.number().min(0).max(1) }),
] as const;

const VIEW_OPTIONS = [
  z.object({ type: z.literal('toggleMirror'), axis: z.enum(['h', 'v']) }),
  z.object({ type: z.literal('nudgeFontSize'), steps: z.number().int().min(-10).max(10) }),
  z.object({ type: z.literal('toggleHud') }),
  z.object({ type: z.literal('toggleGuide') }),
  z.object({ type: z.literal('toggleFullscreen') }),
  z.object({ type: z.literal('toggleVoice') }),
  z.object({ type: z.literal('toggleCamera') }),
  z.object({ type: z.literal('toggleRecording') }),
  z.object({ type: z.literal('help') }),
  z.object({ type: z.literal('exit') }),
] as const;

export const EngineCommandSchema = z.discriminatedUnion('type', [...ENGINE_OPTIONS]);
export const ViewCommandSchema = z.discriminatedUnion('type', [...VIEW_OPTIONS]);
export const CommandSchema = z.discriminatedUnion('type', [...ENGINE_OPTIONS, ...VIEW_OPTIONS]);

// Compile-time checks that the schemas produce exactly the command types.
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
const engineMatches: Same<z.infer<typeof EngineCommandSchema>, EngineCommand> = true;
const viewMatches: Same<z.infer<typeof ViewCommandSchema>, ViewCommand> = true;
const commandMatches: Same<z.infer<typeof CommandSchema>, Command> = true;
void [engineMatches, viewMatches, commandMatches];
