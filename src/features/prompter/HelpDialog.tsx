import { X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { ACTION_IDS, type ActionId } from '@/core/keymap/actions';
import { formatBinding } from '@/core/keymap/match';
import type { Keymap } from '@/core/keymap/presets';
import { useT } from '@/i18n';
import { IconButton } from '@/ui/Button';
import { actionLabel } from './actionLabels';
import styles from './HelpDialog.module.css';

const HIDDEN = new Set<ActionId>([
  'marker2',
  'marker3',
  'marker4',
  'marker5',
  'marker6',
  'marker7',
  'marker8',
  'marker9',
]);

interface HelpDialogProps {
  open: boolean;
  keymap: Keymap;
  onClose: () => void;
}

export function HelpDialog({ open, keymap, onClose }: HelpDialogProps) {
  const t = useT();
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      aria-labelledby="tp-help-title"
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <header className={styles.header}>
        <h2 id="tp-help-title">{t('help.title')}</h2>
        <IconButton label={t('action.close')} onClick={onClose}>
          <X size={20} aria-hidden />
        </IconButton>
      </header>
      <p className={styles.hint}>{t('help.hint')}</p>
      <dl className={styles.list}>
        {ACTION_IDS.filter((action) => !HIDDEN.has(action) && keymap[action]?.length).map((action) => (
          <div key={action} className={styles.row}>
            <dt>{t(actionLabel(action))}</dt>
            <dd>
              {action === 'marker1' ? (
                <kbd>1–9</kbd>
              ) : (
                keymap[action]!.map((binding, i) => <kbd key={i}>{formatBinding(binding)}</kbd>)
              )}
            </dd>
          </div>
        ))}
      </dl>
    </dialog>
  );
}
