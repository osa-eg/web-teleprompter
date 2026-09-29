import { Plus, RotateCcw, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ACTION_IDS, type ActionId } from '@/core/keymap/actions';
import { bindingFromEvent, bindingMatches, findConflicts, formatBinding } from '@/core/keymap/match';
import { resolveKeymap, type KeymapPreset } from '@/core/keymap/presets';
import { actionLabel } from '@/features/prompter/actionLabels';
import { useT } from '@/i18n';
import { useSettings } from '@/stores/settings';
import { Button } from '@/ui/Button';
import { Choice, Section } from '@/ui/controls';
import { toast } from '@/ui/toast';
import styles from './KeymapEditor.module.css';

const MODIFIER_KEYS = new Set(['Shift', 'Control', 'Alt', 'Meta', 'AltGraph', 'CapsLock']);

/** Choose a control preset and add/remove keys per action (capturing the next key press). */
export function KeymapEditor() {
  const t = useT();
  const settings = useSettings((s) => s.settings.keymap);
  const patch = useSettings((s) => s.patch);
  const keymap = resolveKeymap(settings.preset, settings.overrides);
  const [capturing, setCapturing] = useState<ActionId | null>(null);

  useEffect(() => {
    if (!capturing) return;
    const onKeyDown = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();
      if (MODIFIER_KEYS.has(event.key)) return; // wait for the actual key
      if (event.code === 'Escape' && !event.shiftKey && !event.ctrlKey && !event.altKey && !event.metaKey) {
        setCapturing(null);
        return;
      }
      const current = useSettings.getState().settings.keymap;
      const map = resolveKeymap(current.preset, current.overrides);
      const binding = bindingFromEvent(event);
      const conflicts = findConflicts(map, binding, capturing);
      const overrides = { ...current.overrides };
      for (const other of conflicts) {
        overrides[other] = (map[other] ?? []).filter((b) => !bindingMatches(b, event));
      }
      const existing = map[capturing] ?? [];
      if (!existing.some((b) => bindingMatches(b, event))) overrides[capturing] = [...existing, binding];
      patch('keymap', { overrides });
      const [first] = conflicts;
      if (first) {
        toast({
          message: t('keymap.conflict', { key: formatBinding(binding), action: t(actionLabel(first)) }),
        });
      }
      setCapturing(null);
    };
    window.addEventListener('keydown', onKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true });
  }, [capturing, patch, t]);

  const removeBinding = (action: ActionId, index: number) => {
    const current = keymap[action] ?? [];
    patch('keymap', {
      overrides: { ...settings.overrides, [action]: current.filter((_, i) => i !== index) },
    });
  };

  return (
    <Section
      title={t('settings.keyboard')}
      actions={
        <Button
          size="sm"
          variant="ghost"
          icon={<RotateCcw size={16} aria-hidden />}
          disabled={Object.keys(settings.overrides).length === 0}
          onClick={() => patch('keymap', { overrides: {} })}
        >
          {t('keymap.reset')}
        </Button>
      }
    >
      <Choice<KeymapPreset>
        label={t('keymap.preset')}
        value={settings.preset}
        onChange={(preset) => patch('keymap', { preset, overrides: {} })}
        options={[
          { value: 'keyboard', label: t('keymap.preset.keyboard') },
          { value: 'clicker', label: t('keymap.preset.clicker') },
          { value: 'clickerSpeed', label: t('keymap.preset.clickerSpeed') },
          { value: 'pedal', label: t('keymap.preset.pedal') },
        ]}
        hint={t('keymap.hint')}
      />
      <table className={styles.table}>
        <tbody>
          {ACTION_IDS.map((action) => (
            <tr key={action} data-action={action}>
              <th scope="row">
                {action.startsWith('marker')
                  ? `${t('prompter.sections')} ${action.slice('marker'.length)}`
                  : t(actionLabel(action))}
              </th>
              <td>
                <div className={styles.keys}>
                  {(keymap[action] ?? []).map((binding, index) => (
                    <span key={`${binding.code}-${index}`} className={styles.key}>
                      <kbd dir="ltr">{formatBinding(binding)}</kbd>
                      <button
                        type="button"
                        aria-label={t('keymap.remove', { key: formatBinding(binding) })}
                        onClick={() => removeBinding(action, index)}
                      >
                        <X size={12} aria-hidden />
                      </button>
                    </span>
                  ))}
                  <button
                    type="button"
                    className={styles.add}
                    aria-pressed={capturing === action}
                    onClick={() => setCapturing(capturing === action ? null : action)}
                  >
                    {capturing === action ? (
                      t('keymap.press')
                    ) : (
                      <>
                        <Plus size={12} aria-hidden /> {t('keymap.add')}
                      </>
                    )}
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Section>
  );
}
