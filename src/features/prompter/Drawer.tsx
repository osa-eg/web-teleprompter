import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { useT } from '@/i18n';
import { IconButton } from '@/ui/Button';
import styles from './Drawer.module.css';

interface DrawerProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  testId?: string;
}

/** Side panel over the prompter (never mirrored); changes apply live to the stage behind it. */
export function Drawer({ title, onClose, children, testId }: DrawerProps) {
  const t = useT();
  return (
    <aside className={styles.drawer} aria-label={title} data-testid={testId}>
      <header className={styles.header}>
        <h2>{title}</h2>
        <IconButton label={t('action.close')} onClick={onClose}>
          <X size={20} aria-hidden />
        </IconButton>
      </header>
      <div className={styles.body}>{children}</div>
    </aside>
  );
}
