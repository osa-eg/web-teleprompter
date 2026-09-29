import type { ActionId } from '@/core/keymap/actions';
import type { MessageKey } from '@/i18n';

/** Translation key describing a keyboard action (markers 1–9 share one label). */
export function actionLabel(action: ActionId): MessageKey {
  return action.startsWith('marker') ? 'keys.marker' : (`keys.${action}` as MessageKey);
}
