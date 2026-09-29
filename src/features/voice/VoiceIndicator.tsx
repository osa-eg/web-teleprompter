import { useT, type MessageKey } from '@/i18n';
import type { VoiceStatus } from './VoiceController';
import { useLevel, type LevelStore } from './useVoiceControl';
import styles from './VoiceIndicator.module.css';

const TEXT: Record<Exclude<VoiceStatus, 'off'>, MessageKey> = {
  starting: 'voice.status.starting',
  listening: 'voice.status.listening',
  speaking: 'voice.status.speaking',
  unsupported: 'voice.status.unsupported',
  denied: 'voice.status.denied',
  network: 'voice.status.network',
  error: 'voice.status.error',
};

const PROBLEMS = new Set<VoiceStatus>(['unsupported', 'denied', 'network', 'error']);

function Meter({ level }: { level: LevelStore }) {
  const value = useLevel(level);
  return (
    <span className={styles.meter} aria-hidden>
      <span className={styles.meterFill} style={{ inlineSize: `${Math.round(value * 100)}%` }} />
    </span>
  );
}

/** Voice status next to the microphone button (and why it stopped, when it did). */
export function VoiceIndicator({
  status,
  level,
  showMeter,
}: {
  status: VoiceStatus;
  level: LevelStore;
  showMeter: boolean;
}) {
  const t = useT();
  if (status === 'off') return null;
  return (
    <span
      className={styles.indicator}
      data-status={status}
      data-problem={PROBLEMS.has(status) || undefined}
      role="status"
      data-testid="voice-status"
    >
      <span className={styles.dot} aria-hidden />
      <span className={styles.text}>{t(TEXT[status])}</span>
      {showMeter && !PROBLEMS.has(status) && <Meter level={level} />}
    </span>
  );
}
