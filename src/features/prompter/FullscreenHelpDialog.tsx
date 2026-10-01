import { Share, X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useT } from '@/i18n';
import { IconButton } from '@/ui/Button';
import styles from './FullscreenHelpDialog.module.css';

/** iPhone Safari cannot hide its bars for a page: explain the Home Screen app and Hide Toolbar. */
export function FullscreenHelpDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
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
      aria-labelledby="tp-fullscreen-help-title"
      data-testid="fullscreen-help"
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <header className={styles.header}>
        <h2 id="tp-fullscreen-help-title">{t('fullscreen.iphoneTitle')}</h2>
        <IconButton label={t('action.close')} onClick={onClose}>
          <X size={20} aria-hidden />
        </IconButton>
      </header>
      <p className={styles.muted}>{t('fullscreen.iphoneIntro')}</p>
      <ol className={styles.steps}>
        <li>
          <Share size={18} aria-hidden className={styles.icon} />
          <span>{t('fullscreen.iphoneHome')}</span>
        </li>
        <li>
          <span className={styles.aa} aria-hidden>
            aA
          </span>
          <span>{t('fullscreen.iphoneToolbar')}</span>
        </li>
      </ol>
    </dialog>
  );
}
