import { CloudDownload, Download, RotateCcw, ShieldCheck, Upload } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { parseBackup } from '@/core/import/backup';
import { cacheAllFonts } from '@/features/fonts/offlineFonts';
import { useFormat, useT } from '@/i18n';
import { downloadText } from '@/lib/download';
import { storageStatus, type StorageStatus } from '@/storage/persistence';
import { useSettings } from '@/stores/settings';
import { Button } from '@/ui/Button';
import { Section, Switch } from '@/ui/controls';
import { toast } from '@/ui/toast';
import { buildBackup, restoreBackup } from './backupActions';
import styles from './StoragePanel.module.css';

function formatBytes(bytes: number, number: (value: number, options?: Intl.NumberFormatOptions) => string) {
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${number(value, { maximumFractionDigits: 1 })} ${units[unit]}`;
}

export function StoragePanel() {
  const t = useT();
  const fmt = useFormat();
  const resetAll = useSettings((s) => s.resetAll);
  const [status, setStatus] = useState<StorageStatus | null>(null);
  const [includeFonts, setIncludeFonts] = useState(false);
  const [restoreSettings, setRestoreSettings] = useState(false);
  const [offline, setOffline] = useState<{ done: number; total: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    void storageStatus().then((value) => {
      if (!cancelled) setStatus(value);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const protect = async () => {
    await navigator.storage?.persist?.().catch(() => false);
    setStatus(await storageStatus());
  };

  const download = async () => {
    const backup = await buildBackup(includeFonts);
    const date = new Date().toISOString().slice(0, 10);
    downloadText(`teleprompter-backup-${date}.json`, JSON.stringify(backup), 'application/json');
  };

  const restore = async (file: File | undefined) => {
    if (!file) return;
    const parsed = parseBackup(await file.text());
    if (!parsed.ok) {
      toast({ message: t('backup.invalid'), tone: 'error' });
      return;
    }
    const count = await restoreBackup(parsed.backup, { settings: restoreSettings });
    toast({ message: t('backup.restored', { count }), tone: 'success' });
  };

  const makeFontsOffline = async () => {
    setOffline({ done: 0, total: 0 });
    await cacheAllFonts((done, total) => setOffline({ done, total }));
    toast({ message: t('offline.done'), tone: 'success' });
    setOffline(null);
  };

  return (
    <>
      <Section title={t('settings.storage')}>
        {status && (
          <div className={styles.status} data-persisted={status.persisted}>
            <ShieldCheck size={20} aria-hidden />
            <div>
              <p>{status.persisted ? t('storage.persisted') : t('storage.notPersisted')}</p>
              {status.usage !== null && status.quota !== null && (
                <p className={styles.muted}>
                  {t('storage.usage', {
                    used: formatBytes(status.usage, fmt.number),
                    quota: formatBytes(status.quota, fmt.number),
                  })}
                </p>
              )}
            </div>
            {!status.persisted && (
              <Button size="sm" onClick={() => void protect()}>
                {t('storage.persist')}
              </Button>
            )}
          </div>
        )}
        <p className={styles.muted}>{t('storage.safariHint')}</p>

        <div className={styles.row}>
          <Switch label={t('backup.includeFonts')} checked={includeFonts} onChange={setIncludeFonts} />
          <Button icon={<Download size={16} aria-hidden />} onClick={() => void download()}>
            {t('backup.export')}
          </Button>
        </div>
        <div className={styles.row}>
          <Switch
            label={t('backup.restoreSettings')}
            checked={restoreSettings}
            onChange={setRestoreSettings}
          />
          <Button icon={<Upload size={16} aria-hidden />} onClick={() => fileRef.current?.click()}>
            {t('backup.restore')}
          </Button>
          <input
            ref={fileRef}
            type="file"
            hidden
            accept=".json,application/json"
            data-testid="restore-input"
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              event.currentTarget.value = '';
              void restore(file);
            }}
          />
        </div>
      </Section>

      <Section title={t('offline.title')}>
        <p className={styles.muted}>{t('offline.hint')}</p>
        <div>
          <Button
            icon={<CloudDownload size={16} aria-hidden />}
            disabled={offline !== null}
            onClick={() => void makeFontsOffline()}
          >
            {offline
              ? t('offline.progress', { done: offline.done, total: offline.total })
              : t('offline.fonts')}
          </Button>
        </div>
      </Section>

      <Section title={t('settings.resetAll')}>
        <div>
          <Button
            variant="danger"
            icon={<RotateCcw size={16} aria-hidden />}
            onClick={() => {
              if (!window.confirm(t('settings.resetAll'))) return;
              resetAll();
              toast({ message: t('settings.resetDone') });
            }}
          >
            {t('settings.resetAll')}
          </Button>
        </div>
      </Section>
    </>
  );
}
