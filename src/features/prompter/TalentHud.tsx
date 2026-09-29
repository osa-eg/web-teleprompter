import { useEffect, useState } from 'react';
import type { EngineStatus } from '@/core/engine/types';
import type { Formatters, Translate } from '@/i18n';
import type { HudItem } from '@/stores/settingsSchema';
import styles from './TalentHud.module.css';

function Clock({ fmt }: { fmt: Formatters }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return <span>{fmt.clock(now)}</span>;
}

interface TalentHudProps {
  /** Direction of the interface language (the HUD labels are in that language). */
  dir: 'rtl' | 'ltr';
  status: EngineStatus;
  items: HudItem[];
  markerTitle: string | null;
  t: Translate;
  fmt: Formatters;
}

/** Timer, progress and section title for the person reading (drawn inside the mirrored stage). */
export function TalentHud({ dir, status, items, markerTitle, t, fmt }: TalentHudProps) {
  const has = (item: HudItem) => items.includes(item);
  const state =
    status.play === 'ended'
      ? t('prompter.ended')
      : status.holding
        ? t('prompter.holding')
        : status.play === 'paused'
          ? t('prompter.paused')
          : null;

  return (
    <div className={styles.hud} data-testid="talent-hud" dir={dir}>
      {has('progress') && (
        <div className={styles.progress}>
          <div className={styles.fill} style={{ inlineSize: `${(status.progress * 100).toFixed(2)}%` }} />
        </div>
      )}
      <div className={styles.row}>
        <span className={styles.cell}>
          {has('elapsed') && <bdi dir="ltr">{fmt.duration(status.elapsedMs)}</bdi>}
        </span>
        <span className={styles.center} dir="auto">
          {state ? <span className={styles.state}>{state}</span> : has('marker') && markerTitle}
        </span>
        <span className={styles.cell}>
          {has('wpm') && <span>{t('prompter.wpm', { wpm: status.wpm })}</span>}
          {has('remaining') && <bdi dir="ltr">−{fmt.duration(status.remainingMs)}</bdi>}
          {has('clock') && <Clock fmt={fmt} />}
        </span>
      </div>
    </div>
  );
}
