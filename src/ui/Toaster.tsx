import { X } from 'lucide-react';
import clsx from 'clsx';
import { useT } from '@/i18n';
import { useToasts } from './toast';
import styles from './Toaster.module.css';

export function Toaster() {
  const t = useT();
  const toasts = useToasts((s) => s.toasts);
  const dismiss = useToasts((s) => s.dismiss);

  return (
    <div className={styles.region} role="status" aria-live="polite">
      {toasts.map((item) => (
        <div key={item.id} className={clsx(styles.toast, styles[item.tone])}>
          <span className={styles.message}>{item.message}</span>
          {item.action && (
            <button
              type="button"
              className={styles.action}
              onClick={() => {
                item.action?.run();
                dismiss(item.id);
              }}
            >
              {item.action.label}
            </button>
          )}
          <button
            type="button"
            className={styles.close}
            aria-label={t('action.close')}
            onClick={() => dismiss(item.id)}
          >
            <X size={16} aria-hidden />
          </button>
        </div>
      ))}
    </div>
  );
}
