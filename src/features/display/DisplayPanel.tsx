import { MonitorUp, X } from 'lucide-react';
import { useT } from '@/i18n';
import { MirrorSection } from '@/features/settings/sections';
import { Drawer } from '@/features/prompter/Drawer';
import { Button } from '@/ui/Button';
import { Section } from '@/ui/controls';
import { toast } from '@/ui/toast';
import { closeDisplayWindow, openDisplayWindow } from './displayWindow';
import styles from './DisplayPanel.module.css';

interface DisplayPanelProps {
  scriptId: string;
  sid: string;
  connected: boolean;
  onClose: () => void;
}

/** Operator drawer: open the display window for the teleprompter monitor and set its mirroring. */
export function DisplayPanel({ scriptId, sid, connected, onClose }: DisplayPanelProps) {
  const t = useT();
  const open = async () => {
    const ok = await openDisplayWindow(scriptId, sid);
    if (!ok) toast({ message: t('display.blocked'), tone: 'error', duration: 8000 });
  };

  return (
    <Drawer title={t('display.title')} onClose={onClose} testId="display-panel">
      <Section title={t('display.title')}>
        <p className={styles.intro}>{t('display.intro')}</p>
        <p className={styles.status} data-state={connected ? 'connected' : 'closed'} role="status">
          <span className={styles.dot} aria-hidden />
          {connected ? t('display.connected') : t('display.notConnected')}
        </p>
        <div className={styles.actions}>
          <Button variant="primary" icon={<MonitorUp size={18} aria-hidden />} onClick={() => void open()}>
            {connected ? t('display.show') : t('display.open')}
          </Button>
          {connected && (
            <Button icon={<X size={18} aria-hidden />} onClick={() => closeDisplayWindow(sid)}>
              {t('display.close')}
            </Button>
          )}
        </div>
        <p className={styles.hint}>{t('display.fullscreenHint')}</p>
      </Section>
      <MirrorSection target="display" title={t('display.mirror')} />
    </Drawer>
  );
}
