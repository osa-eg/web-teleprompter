import type { Command } from '../commands/types';

export const ACTION_IDS = [
  'togglePlay',
  'faster',
  'slower',
  'lineForward',
  'lineBack',
  'nextBlock',
  'prevBlock',
  'nextMarker',
  'prevMarker',
  'marker1',
  'marker2',
  'marker3',
  'marker4',
  'marker5',
  'marker6',
  'marker7',
  'marker8',
  'marker9',
  'toStart',
  'toEnd',
  'fontBigger',
  'fontSmaller',
  'mirrorH',
  'mirrorV',
  'fullscreen',
  'toggleHud',
  'toggleGuide',
  'reset',
  'toggleVoice',
  'toggleCamera',
  'toggleRecording',
  'help',
  'exit',
] as const;

export type ActionId = (typeof ACTION_IDS)[number];

/** Actions that repeat while the key is held (with acceleration). */
export const REPEATABLE: ReadonlySet<ActionId> = new Set([
  'faster',
  'slower',
  'lineForward',
  'lineBack',
  'fontBigger',
  'fontSmaller',
]);

export function actionCommand(action: ActionId): Command {
  switch (action) {
    case 'togglePlay':
      return { type: 'toggle' };
    case 'faster':
      return { type: 'nudgeWpm', steps: 1 };
    case 'slower':
      return { type: 'nudgeWpm', steps: -1 };
    case 'lineForward':
      return { type: 'nudgeLines', lines: 1 };
    case 'lineBack':
      return { type: 'nudgeLines', lines: -1 };
    case 'nextBlock':
      return { type: 'jumpBlock', delta: 1 };
    case 'prevBlock':
      return { type: 'jumpBlock', delta: -1 };
    case 'nextMarker':
      return { type: 'jumpMarker', delta: 1 };
    case 'prevMarker':
      return { type: 'jumpMarker', delta: -1 };
    case 'toStart':
      return { type: 'toStart' };
    case 'toEnd':
      return { type: 'toEnd' };
    case 'fontBigger':
      return { type: 'nudgeFontSize', steps: 1 };
    case 'fontSmaller':
      return { type: 'nudgeFontSize', steps: -1 };
    case 'mirrorH':
      return { type: 'toggleMirror', axis: 'h' };
    case 'mirrorV':
      return { type: 'toggleMirror', axis: 'v' };
    case 'fullscreen':
      return { type: 'toggleFullscreen' };
    case 'toggleHud':
      return { type: 'toggleHud' };
    case 'toggleGuide':
      return { type: 'toggleGuide' };
    case 'reset':
      return { type: 'reset' };
    case 'toggleVoice':
      return { type: 'toggleVoice' };
    case 'toggleCamera':
      return { type: 'toggleCamera' };
    case 'toggleRecording':
      return { type: 'toggleRecording' };
    case 'help':
      return { type: 'help' };
    case 'exit':
      return { type: 'exit' };
    default:
      return { type: 'gotoMarker', index: Number(action.slice('marker'.length)) - 1 };
  }
}
