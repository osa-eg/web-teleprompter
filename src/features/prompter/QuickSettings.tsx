import { X } from 'lucide-react';
import { useT } from '@/i18n';
import type { Script } from '@/storage/types';
import { IconButton } from '@/ui/Button';
import {
  ColorsSection,
  GuideSection,
  MirrorSection,
  PlaybackSection,
  TextSection,
} from '@/features/settings/sections';
import styles from './QuickSettings.module.css';

interface QuickSettingsProps {
  script: Script;
  rtlDominant: boolean;
  onClose: () => void;
}

/** Live display settings drawer; changes apply instantly to the stage behind it. */
export function QuickSettings({ script, rtlDominant, onClose }: QuickSettingsProps) {
  const t = useT();
  return (
    <aside className={styles.drawer} aria-label={t('prompter.settings')} data-testid="quick-settings">
      <header className={styles.header}>
        <h2>{t('prompter.settings')}</h2>
        <IconButton label={t('action.close')} onClick={onClose}>
          <X size={20} aria-hidden />
        </IconButton>
      </header>
      <div className={styles.body}>
        <TextSection script={script} rtlDominant={rtlDominant} />
        <GuideSection />
        <ColorsSection />
        <PlaybackSection />
        <MirrorSection />
      </div>
    </aside>
  );
}
