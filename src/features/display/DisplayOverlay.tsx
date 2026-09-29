import { Maximize, MonitorSmartphone } from 'lucide-react';
import { useState } from 'react';
import { useT } from '@/i18n';
import { Button } from '@/ui/Button';
import { canUseOtherScreens, fullscreenOnOtherScreen } from './displayWindow';
import styles from './DisplayOverlay.module.css';

interface DisplayOverlayProps {
  connected: boolean;
  fullscreen: { supported: boolean; active: boolean; toggle: () => void };
  onDismiss: () => void;
}

/**
 * First thing shown in a display window: full screen needs a click in this window itself (and can
 * target another screen where the Window Management API is available).
 */
export function DisplayOverlay({ connected, fullscreen, onDismiss }: DisplayOverlayProps) {
  const t = useT();
  const [message, setMessage] = useState<string | null>(null);

  const otherScreen = async () => {
    const result = await fullscreenOnOtherScreen();
    if (result === 'ok') onDismiss();
    else setMessage(result === 'no-screen' ? t('display.noOtherScreen') : t('display.otherScreenFailed'));
  };

  return (
    <div className={styles.overlay} data-testid="display-overlay">
      <div className={styles.card} role="dialog" aria-labelledby="display-overlay-title">
        <h1 id="display-overlay-title">{t('display.title')}</h1>
        <p className={styles.status} data-state={connected ? 'connected' : 'waiting'} role="status">
          {connected ? t('display.linked') : t('display.waiting')}
        </p>
        <p className={styles.hint}>{t('display.overlayHint')}</p>
        <div className={styles.actions}>
          {fullscreen.supported && (
            <Button
              variant="primary"
              size="lg"
              icon={<Maximize size={20} aria-hidden />}
              onClick={() => {
                fullscreen.toggle();
                onDismiss();
              }}
            >
              {t('display.fullscreen')}
            </Button>
          )}
          {fullscreen.supported && canUseOtherScreens() && (
            <Button
              size="lg"
              icon={<MonitorSmartphone size={20} aria-hidden />}
              onClick={() => void otherScreen()}
            >
              {t('display.otherScreen')}
            </Button>
          )}
          <Button variant="ghost" onClick={onDismiss}>
            {t('display.stayWindowed')}
          </Button>
        </div>
        {message && (
          <p className={styles.error} role="alert">
            {message}
          </p>
        )}
      </div>
    </div>
  );
}
