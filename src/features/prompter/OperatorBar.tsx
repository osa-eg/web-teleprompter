import clsx from 'clsx';
import {
  AArrowDown,
  AArrowUp,
  ArrowLeft,
  ChevronsDown,
  ChevronsUp,
  FlipHorizontal2,
  FlipVertical2,
  Keyboard,
  Maximize,
  Mic,
  MicOff,
  Minimize,
  Minus,
  MonitorUp,
  Pause,
  Play,
  Plus,
  RotateCcw,
  SlidersHorizontal,
  Smartphone,
  Video,
  VideoOff,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import type { Command } from '@/core/commands/types';
import type { Marker } from '@/core/script/ast';
import type { EngineStatus } from '@/core/engine/types';
import { useFormat, useT } from '@/i18n';
import type { ViewSettings } from '@/stores/settingsSchema';
import { IconButton } from '@/ui/Button';
import styles from './OperatorBar.module.css';

export type Panel = 'settings' | 'display' | 'remote';

interface OperatorBarProps {
  status: EngineStatus;
  wpm: number;
  markers: Marker[];
  /** Mirroring of the window the talent reads (the display window when one is connected). */
  mirror: ViewSettings;
  hidden: boolean;
  fullscreen: { supported: boolean; active: boolean };
  editorHref: string;
  panel: Panel | null;
  displayConnected: boolean;
  remoteDevices?: number;
  voiceOn?: boolean;
  /** Voice status shown next to the microphone button. */
  voiceStatus?: ReactNode;
  cameraOn?: boolean;
  /** Record button and recording time. */
  recordControl?: ReactNode;
  onCommand: (command: Command) => void;
  onPanel: (panel: Panel) => void;
}

/** Operator controls below the stage (never mirrored). */
export function OperatorBar({
  status,
  wpm,
  markers,
  mirror,
  hidden,
  fullscreen,
  editorHref,
  panel,
  displayConnected,
  remoteDevices = 0,
  voiceOn = false,
  voiceStatus,
  cameraOn = false,
  recordControl,
  onCommand,
  onPanel,
}: OperatorBarProps) {
  const t = useT();
  const fmt = useFormat();
  const playing = status.play === 'playing' || status.play === 'countdown';

  return (
    <div className={clsx(styles.bar, hidden && styles.hidden)} data-testid="operator-bar">
      <div className={styles.progressRow}>
        <span className={styles.time} dir="ltr">
          {fmt.duration(status.elapsedMs)}
        </span>
        <input
          type="range"
          className={styles.progress}
          aria-label={t('prompter.progress')}
          min={0}
          max={1000}
          value={Math.round(status.progress * 1000)}
          onChange={(e) =>
            onCommand({ type: 'seekProgress', progress: Number(e.currentTarget.value) / 1000 })
          }
        />
        <span className={styles.time} dir="ltr">
          −{fmt.duration(status.remainingMs)}
        </span>
      </div>

      <div className={styles.controls}>
        <div className={styles.group}>
          <Link
            to={editorHref}
            className={styles.back}
            aria-label={t('prompter.backToEditor')}
            title={t('prompter.backToEditor')}
          >
            <ArrowLeft size={20} aria-hidden className="flip-rtl" />
          </Link>
          {markers.length > 0 && (
            <select
              className={styles.sections}
              aria-label={t('prompter.sections')}
              value={status.marker}
              onChange={(e) => onCommand({ type: 'gotoMarker', index: Number(e.currentTarget.value) })}
            >
              {status.marker < 0 && <option value={-1}>{t('prompter.sections')}</option>}
              {markers.map((marker, i) => (
                <option key={i} value={i}>
                  {'  '.repeat(marker.level - 1)}
                  {marker.title || '—'}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className={clsx(styles.group, styles.transport)}>
          <IconButton label={t('prompter.reset')} onClick={() => onCommand({ type: 'reset' })}>
            <RotateCcw size={20} aria-hidden />
          </IconButton>
          <IconButton
            label={t('prompter.prevBlock')}
            onClick={() => onCommand({ type: 'jumpBlock', delta: -1 })}
          >
            <ChevronsUp size={22} aria-hidden />
          </IconButton>
          <IconButton
            label={playing ? t('prompter.pause') : t('prompter.play')}
            variant="primary"
            size="lg"
            className={styles.play}
            data-testid="play-toggle"
            onClick={() => onCommand({ type: 'toggle' })}
          >
            {playing ? <Pause size={26} aria-hidden /> : <Play size={26} aria-hidden />}
          </IconButton>
          <IconButton
            label={t('prompter.nextBlock')}
            onClick={() => onCommand({ type: 'jumpBlock', delta: 1 })}
          >
            <ChevronsDown size={22} aria-hidden />
          </IconButton>
        </div>

        <div className={styles.group} role="group" aria-label={t('prompter.wpmLabel')}>
          <IconButton label={t('prompter.slower')} onClick={() => onCommand({ type: 'nudgeWpm', steps: -1 })}>
            <Minus size={18} aria-hidden />
          </IconButton>
          <output className={styles.wpm} data-testid="wpm" title={t('prompter.wpmLabel')}>
            {t('prompter.wpm', { wpm })}
          </output>
          <IconButton label={t('prompter.faster')} onClick={() => onCommand({ type: 'nudgeWpm', steps: 1 })}>
            <Plus size={18} aria-hidden />
          </IconButton>
        </div>

        <div className={clsx(styles.group, styles.tools)}>
          {recordControl}
          <IconButton
            label={t('camera.toggle')}
            pressed={cameraOn}
            data-testid="camera-button"
            onClick={() => onCommand({ type: 'toggleCamera' })}
          >
            {cameraOn ? <Video size={20} aria-hidden /> : <VideoOff size={20} aria-hidden />}
          </IconButton>
          {voiceStatus}
          <IconButton
            label={t('voice.title')}
            pressed={voiceOn}
            data-testid="voice-button"
            onClick={() => onCommand({ type: 'toggleVoice' })}
          >
            {voiceOn ? <Mic size={20} aria-hidden /> : <MicOff size={20} aria-hidden />}
          </IconButton>
          <IconButton
            label={t('prompter.fontSmaller')}
            onClick={() => onCommand({ type: 'nudgeFontSize', steps: -1 })}
          >
            <AArrowDown size={20} aria-hidden />
          </IconButton>
          <IconButton
            label={t('prompter.fontBigger')}
            onClick={() => onCommand({ type: 'nudgeFontSize', steps: 1 })}
          >
            <AArrowUp size={20} aria-hidden />
          </IconButton>
          <IconButton
            label={t('prompter.mirrorH')}
            pressed={mirror.mirrorH}
            onClick={() => onCommand({ type: 'toggleMirror', axis: 'h' })}
          >
            <FlipHorizontal2 size={20} aria-hidden />
          </IconButton>
          <IconButton
            label={t('prompter.mirrorV')}
            pressed={mirror.mirrorV}
            onClick={() => onCommand({ type: 'toggleMirror', axis: 'v' })}
          >
            <FlipVertical2 size={20} aria-hidden />
          </IconButton>
          <IconButton
            label={t('prompter.settings')}
            pressed={panel === 'settings'}
            onClick={() => onPanel('settings')}
          >
            <SlidersHorizontal size={20} aria-hidden />
          </IconButton>
          <IconButton
            label={t('display.title')}
            pressed={panel === 'display'}
            className={clsx(displayConnected && styles.linked)}
            data-testid="display-button"
            onClick={() => onPanel('display')}
          >
            <MonitorUp size={20} aria-hidden />
          </IconButton>
          <IconButton
            label={t('remote.title')}
            pressed={panel === 'remote'}
            className={clsx(remoteDevices > 0 && styles.linked)}
            data-testid="remote-button"
            onClick={() => onPanel('remote')}
          >
            <Smartphone size={20} aria-hidden />
          </IconButton>
          <IconButton label={t('prompter.help')} onClick={() => onCommand({ type: 'help' })}>
            <Keyboard size={20} aria-hidden />
          </IconButton>
          {fullscreen.supported && (
            <IconButton
              label={fullscreen.active ? t('prompter.exitFullscreen') : t('prompter.fullscreen')}
              onClick={() => onCommand({ type: 'toggleFullscreen' })}
            >
              {fullscreen.active ? <Minimize size={20} aria-hidden /> : <Maximize size={20} aria-hidden />}
            </IconButton>
          )}
        </div>
      </div>
    </div>
  );
}
