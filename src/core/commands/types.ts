/** Commands understood by the scroll engine (and forwarded between windows/devices). */
export type EngineCommand =
  | { type: 'play' }
  | { type: 'pause' }
  | { type: 'toggle' }
  /** Stop and return to the top. */
  | { type: 'reset' }
  | { type: 'toStart' }
  | { type: 'toEnd' }
  | { type: 'setWpm'; wpm: number }
  | { type: 'nudgeWpm'; steps: number }
  | { type: 'nudgeLines'; lines: number }
  | { type: 'nudgePages'; pages: number }
  | { type: 'jumpBlock'; delta: -1 | 1 }
  | { type: 'jumpMarker'; delta: -1 | 1 }
  | { type: 'gotoMarker'; index: number }
  | { type: 'seekPos'; pos: number }
  | { type: 'seekProgress'; progress: number };

/** Commands handled by the prompter view around the engine. */
export type ViewCommand =
  | { type: 'toggleMirror'; axis: 'h' | 'v' }
  | { type: 'nudgeFontSize'; steps: number }
  | { type: 'toggleHud' }
  | { type: 'toggleGuide' }
  | { type: 'toggleFullscreen' }
  | { type: 'toggleVoice' }
  | { type: 'toggleCamera' }
  | { type: 'toggleRecording' }
  | { type: 'help' }
  | { type: 'exit' };

export type Command = EngineCommand | ViewCommand;

const ENGINE_TYPES = new Set<string>([
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

export function isEngineCommand(command: Command): command is EngineCommand {
  return ENGINE_TYPES.has(command.type);
}
