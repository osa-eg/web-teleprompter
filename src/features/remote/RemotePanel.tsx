import { Copy, RefreshCw, Smartphone, X } from 'lucide-react';
import { useMemo } from 'react';
import { buildRemoteLink } from '@/core/remote/security';
import { Drawer } from '@/features/prompter/Drawer';
import { useT } from '@/i18n';
import { useSettings } from '@/stores/settings';
import { Button } from '@/ui/Button';
import { Section } from '@/ui/controls';
import { toast } from '@/ui/toast';
import { disconnectRemoteDevice, retryRemoteHost, useRemoteHostInfo } from './hostService';
import { serverFromSettings } from './peerOptions';
import { QrCode } from './QrCode';
import { useRemoteSession } from './remoteSession';
import styles from './RemotePanel.module.css';

/** The app address phones open: this page's, unless another one is set (e.g. a LAN address). */
function linkBase(custom: string): string {
  try {
    const url = new URL(custom.trim());
    if (url.protocol === 'https:' || url.protocol === 'http:') return url.href;
  } catch {
    // not set, or not a URL
  }
  return window.location.href;
}

/** Operator drawer: turn the phone remote on, show its QR code and the connected phones. */
export function RemotePanel({ onClose }: { onClose: () => void }) {
  const t = useT();
  const { on, hostId, key, setOn, rotate } = useRemoteSession();
  const remote = useSettings((s) => s.settings.remote);
  const info = useRemoteHostInfo();
  const link = useMemo(
    () =>
      buildRemoteLink(linkBase(remote.remoteBaseUrl), { hostId, key, server: serverFromSettings(remote) }),
    [hostId, key, remote],
  );

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      toast({ message: t('remote.copied'), tone: 'success' });
    } catch {
      // Clipboard unavailable (insecure context): the link field can still be selected by hand.
    }
  };

  const statusText =
    info.status === 'ready'
      ? t('remote.ready')
      : info.status === 'error'
        ? t('remote.error')
        : t('remote.starting');

  return (
    <Drawer title={t('remote.title')} onClose={onClose} testId="remote-panel">
      <Section title={t('remote.title')}>
        <p className={styles.muted}>{t('remote.intro')}</p>
        {!on ? (
          <Button variant="primary" icon={<Smartphone size={18} aria-hidden />} onClick={() => setOn(true)}>
            {t('remote.start')}
          </Button>
        ) : (
          <>
            <p className={styles.status} data-state={info.status} role="status" data-testid="remote-status">
              <span className={styles.dot} aria-hidden />
              {statusText}
            </p>
            {info.status === 'error' && <Button onClick={retryRemoteHost}>{t('remote.retry')}</Button>}
            <div className={styles.qr} data-ready={info.status === 'ready' || undefined}>
              <QrCode value={link} label={t('remote.qrLabel')} />
            </div>
            <div className={styles.linkRow}>
              <input
                className={styles.link}
                readOnly
                value={link}
                dir="ltr"
                aria-label={t('remote.link')}
                data-testid="remote-link"
                onFocus={(e) => e.currentTarget.select()}
              />
              <Button size="sm" icon={<Copy size={16} aria-hidden />} onClick={() => void copy()}>
                {t('remote.copyLink')}
              </Button>
            </div>
            <p className={styles.muted}>{t('remote.security')}</p>
          </>
        )}
      </Section>

      {on && (
        <Section title={t('remote.devices')}>
          {info.devices.length === 0 ? (
            <p className={styles.muted}>{t('remote.noDevices')}</p>
          ) : (
            <ul className={styles.devices} data-testid="remote-devices">
              {info.devices.map((device) => (
                <li key={device.id}>
                  <Smartphone size={18} aria-hidden />
                  <span className={styles.deviceName}>{device.name}</span>
                  <Button size="sm" variant="ghost" onClick={() => disconnectRemoteDevice(device.id)}>
                    {t('remote.disconnect')}
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <div className={styles.actions}>
            <Button size="sm" icon={<RefreshCw size={16} aria-hidden />} onClick={rotate}>
              {t('remote.newLink')}
            </Button>
            <Button size="sm" variant="ghost" icon={<X size={16} aria-hidden />} onClick={() => setOn(false)}>
              {t('remote.stop')}
            </Button>
          </div>
          <p className={styles.muted}>{t('remote.newLinkHint')}</p>
        </Section>
      )}
    </Drawer>
  );
}
