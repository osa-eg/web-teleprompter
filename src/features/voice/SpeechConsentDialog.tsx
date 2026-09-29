import { useEffect, useRef } from 'react';
import { useT } from '@/i18n';
import { Button } from '@/ui/Button';
import styles from './SpeechConsentDialog.module.css';

interface Props {
  open: boolean;
  onAccept: () => void;
  onUseVad: () => void;
  onCancel: () => void;
}

/** Asked once before speech recognition sends audio to the browser's cloud service. */
export function SpeechConsentDialog({ open, onAccept, onUseVad, onCancel }: Props) {
  const t = useT();
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog ref={ref} className={styles.dialog} aria-labelledby="tp-consent-title" onClose={onCancel}>
      <h2 id="tp-consent-title">{t('voice.consentTitle')}</h2>
      <p>{t('voice.consentText')}</p>
      <div className={styles.actions}>
        <Button variant="primary" onClick={onAccept}>
          {t('voice.consentAccept')}
        </Button>
        <Button onClick={onUseVad}>{t('voice.consentUseVad')}</Button>
        <Button variant="ghost" onClick={onCancel}>
          {t('action.cancel')}
        </Button>
      </div>
    </dialog>
  );
}
