import clsx from 'clsx';
import {
  AArrowDown,
  AArrowUp,
  ChevronDown,
  ChevronsDown,
  ChevronsUp,
  ChevronUp,
  FlipHorizontal2,
  Minus,
  Pause,
  Play,
  Plus,
  RotateCcw,
} from 'lucide-react';
import { useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';
import type { Command } from '@/core/commands/types';
import { parseRemoteLink, type RemoteLink } from '@/core/remote/security';
import { useWakeLock } from '@/features/prompter/hooks';
import { useFormat, useT, type MessageKey } from '@/i18n';
import { deviceName } from './peerOptions';
import { RemoteClient, type ClientStatus } from './RemoteClient';
import styles from './RemotePage.module.css';

const STATUS_TEXT: Record<ClientStatus, MessageKey> = {
  connecting: 'remote.connecting',
  connected: 'remote.connected',
  reconnecting: 'remote.reconnecting',
  unreachable: 'remote.unreachable',
  denied: 'remote.denied',
  full: 'remote.full',
  error: 'remote.error',
};

/** The phone remote (`#/remote?h=…&k=…`), opened by scanning the prompter's QR code. */
export function RemotePage() {
  const t = useT();
  const [params] = useSearchParams();
  const link = useMemo(() => parseRemoteLink(params), [params]);
  if (!link) {
    return (
      <main className={styles.page}>
        <p className={styles.notice} role="alert">
          {t('remote.invalidLink')}
        </p>
      </main>
    );
  }
  return <RemoteControl key={`${link.hostId}:${link.key}`} link={link} />;
}

function Pad({
  label,
  onPress,
  disabled,
  children,
  className,
  pressed,
  testId,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  children: ReactNode;
  className?: string;
  pressed?: boolean;
  testId?: string;
}) {
  return (
    <button
      type="button"
      className={clsx(styles.pad, className)}
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      disabled={disabled}
      data-testid={testId}
      onClick={onPress}
    >
      {children}
    </button>
  );
}

function RemoteControl({ link }: { link: RemoteLink }) {
  const t = useT();
  const fmt = useFormat();
  const [client] = useState(() => new RemoteClient(link, deviceName()));
  useEffect(() => {
    client.start();
    return () => client.stop();
  }, [client]);
  const { status, script, state } = useSyncExternalStore(client.subscribe, client.getSnapshot);
  const connected = status === 'connected';
  useWakeLock(connected);

  const send = (command: Command) => {
    navigator.vibrate?.(8);
    client.send(command);
  };

  const playing = state?.play === 'playing' || state?.play === 'countdown';
  const markers = script?.markers ?? [];
  const off = !connected || !script;

  return (
    <main className={styles.page} data-status={status}>
      <header className={styles.header}>
        <span className={styles.badge} data-status={status} role="status" data-testid="remote-connection">
          <span className={styles.dot} aria-hidden />
          {t(STATUS_TEXT[status])}
        </span>
        <h1 className={styles.title} dir="auto">
          {script?.title ?? (connected ? t('remote.noScript') : t('remote.title'))}
        </h1>
      </header>

      <section className={styles.progress} aria-label={t('prompter.progress')}>
        <div className={styles.times} dir="ltr">
          <span>{fmt.duration(state?.elapsedMs ?? 0)}</span>
          <span>−{fmt.duration(state?.remainingMs ?? 0)}</span>
        </div>
        <div className={styles.bar}>
          <div className={styles.fill} style={{ inlineSize: `${(state?.progress ?? 0) * 100}%` }} />
        </div>
        <p className={styles.section} dir="auto">
          {state && state.marker >= 0 ? (markers[state.marker]?.title ?? '') : ' '}
        </p>
      </section>

      <div className={styles.controls}>
        <Pad
          label={playing ? t('prompter.pause') : t('prompter.play')}
          className={styles.play}
          disabled={off}
          testId="remote-play"
          onPress={() => send({ type: 'toggle' })}
        >
          {state?.countdown ? (
            <span className={styles.countdown}>{state.countdown}</span>
          ) : playing ? (
            <Pause size={56} aria-hidden />
          ) : (
            <Play size={56} aria-hidden />
          )}
        </Pad>

        <div className={styles.row}>
          <Pad
            label={t('prompter.prevBlock')}
            disabled={off}
            onPress={() => send({ type: 'jumpBlock', delta: -1 })}
          >
            <ChevronUp size={30} aria-hidden />
          </Pad>
          <Pad
            label={t('prompter.nextBlock')}
            disabled={off}
            onPress={() => send({ type: 'jumpBlock', delta: 1 })}
          >
            <ChevronDown size={30} aria-hidden />
          </Pad>
        </div>
        {markers.length > 0 && (
          <div className={styles.row}>
            <Pad
              label={t('remote.prevSection')}
              disabled={off}
              onPress={() => send({ type: 'jumpMarker', delta: -1 })}
            >
              <ChevronsUp size={30} aria-hidden />
            </Pad>
            <Pad
              label={t('remote.nextSection')}
              disabled={off}
              onPress={() => send({ type: 'jumpMarker', delta: 1 })}
            >
              <ChevronsDown size={30} aria-hidden />
            </Pad>
          </div>
        )}

        <div className={styles.speed} role="group" aria-label={t('remote.speed')}>
          <Pad
            label={t('prompter.slower')}
            disabled={off}
            onPress={() => send({ type: 'nudgeWpm', steps: -1 })}
          >
            <Minus size={26} aria-hidden />
          </Pad>
          <output className={styles.wpm} data-testid="remote-wpm">
            {t('prompter.wpm', { wpm: state?.wpm ?? 0 })}
          </output>
          <Pad
            label={t('prompter.faster')}
            disabled={off}
            onPress={() => send({ type: 'nudgeWpm', steps: 1 })}
          >
            <Plus size={26} aria-hidden />
          </Pad>
        </div>

        {markers.length > 0 && (
          <select
            className={styles.select}
            aria-label={t('remote.sections')}
            disabled={off}
            value={state?.marker ?? -1}
            onChange={(e) => send({ type: 'gotoMarker', index: Number(e.currentTarget.value) })}
          >
            {(state?.marker ?? -1) < 0 && <option value={-1}>{t('remote.sections')}</option>}
            {markers.map((marker, i) => (
              <option key={i} value={i}>
                {'  '.repeat(marker.level - 1)}
                {marker.title || '—'}
              </option>
            ))}
          </select>
        )}

        <div className={styles.row}>
          <Pad label={t('prompter.reset')} disabled={off} onPress={() => send({ type: 'reset' })}>
            <RotateCcw size={24} aria-hidden />
          </Pad>
          {state?.canChangeLook && (
            <>
              <Pad
                label={t('prompter.fontSmaller')}
                disabled={off}
                onPress={() => send({ type: 'nudgeFontSize', steps: -1 })}
              >
                <AArrowDown size={24} aria-hidden />
              </Pad>
              <Pad
                label={t('prompter.fontBigger')}
                disabled={off}
                onPress={() => send({ type: 'nudgeFontSize', steps: 1 })}
              >
                <AArrowUp size={24} aria-hidden />
              </Pad>
              <Pad
                label={t('prompter.mirrorH')}
                disabled={off}
                pressed={state.mirrorH}
                onPress={() => send({ type: 'toggleMirror', axis: 'h' })}
              >
                <FlipHorizontal2 size={24} aria-hidden />
              </Pad>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
