import { Circle, Loader, Square } from 'lucide-react';
import { useFormat, useT } from '@/i18n';
import type { RecordState } from './useRecording';
import styles from './RecordButton.module.css';

interface RecordButtonProps {
  state: RecordState;
  elapsedMs: number;
  onToggle: () => void;
}

/** Record / stop, with the running time while recording and a pulse while armed. */
export function RecordButton({ state, elapsedMs, onToggle }: RecordButtonProps) {
  const t = useT();
  const fmt = useFormat();
  const label =
    state === 'recording'
      ? t('camera.stopRecording')
      : state === 'armed'
        ? t('camera.armed')
        : state === 'saving'
          ? t('camera.saving')
          : t('camera.record');
  return (
    <button
      type="button"
      className={styles.button}
      data-state={state}
      aria-label={label}
      title={label}
      aria-pressed={state === 'recording' || state === 'armed'}
      disabled={state === 'saving'}
      data-testid="record-button"
      onClick={onToggle}
    >
      {state === 'recording' ? (
        <>
          <Square size={14} aria-hidden fill="currentColor" />
          <span className={styles.time} dir="ltr">
            {t('camera.rec')} {fmt.duration(elapsedMs)}
          </span>
        </>
      ) : state === 'saving' || state === 'waiting' ? (
        <Loader size={18} aria-hidden className={styles.spin} />
      ) : (
        <Circle size={18} aria-hidden fill={state === 'armed' ? 'currentColor' : 'none'} />
      )}
    </button>
  );
}
