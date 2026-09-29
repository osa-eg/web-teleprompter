import clsx from 'clsx';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { LoadingScreen } from '@/app/LoadingScreen';
import { isEngineCommand, type Command } from '@/core/commands/types';
import type { SyncRole } from '@/core/sync/protocol';
import { fingerprint, resolveResumePos } from '@/core/engine/resume';
import { clampWpm } from '@/core/engine/speed';
import type { EngineConfig } from '@/core/engine/types';
import { actionCommand } from '@/core/keymap/actions';
import { resolveKeymap } from '@/core/keymap/presets';
import { spokenWords } from '@/core/script/ast';
import { parseScript } from '@/core/script/parse';
import { DisplayOverlay } from '@/features/display/DisplayOverlay';
import { DisplayPanel } from '@/features/display/DisplayPanel';
import { getTabSessionId } from '@/features/display/displayWindow';
import { effectiveLineHeight, fontStackFor } from '@/features/fonts/fontSettings';
import { useScriptFonts } from '@/features/fonts/useScriptFonts';
import { useRemoteHostInfo } from '@/features/remote/hostService';
import { RemotePanel } from '@/features/remote/RemotePanel';
import { useRemoteController } from '@/features/remote/useRemoteController';
import { useFormat, useT } from '@/i18n';
import type { Script } from '@/storage/types';
import { useLibrary } from '@/stores/library';
import { useSettings } from '@/stores/settings';
import { ButtonLink } from '@/ui/Button';
import { HelpDialog } from './HelpDialog';
import { useFullscreen, useIdle, useKeymap, usePointerScroll, useWakeLock } from './hooks';
import { useMediaKeys } from './useMediaKeys';
import { OperatorBar, type Panel } from './OperatorBar';
import { QuickSettings } from './QuickSettings';
import type { RenderOptions } from './ScriptView';
import { Stage } from './Stage';
import { TalentHud } from './TalentHud';
import { usePrompterEngine } from './usePrompterEngine';
import { useSync } from './useSync';
import styles from './PrompterPage.module.css';

function useScript(id: string) {
  const status = useLibrary((s) => s.status);
  const script = useLibrary((s) => s.scripts.find((x) => x.id === id));
  useEffect(() => {
    void useLibrary.getState().init();
  }, []);
  return { ready: status === 'ready', script };
}

/** The operator's prompter (`#/s/:id/prompt`). */
export function PrompterPage() {
  const t = useT();
  const { id = '' } = useParams();
  const { ready, script } = useScript(id);
  const [sid] = useState(getTabSessionId);

  if (!ready) return <LoadingScreen label={t('prompter.loading')} />;
  if (!script) {
    return (
      <div className={styles.missing}>
        <p>{t('editor.notFound')}</p>
        <ButtonLink to="/">{t('error.backToLibrary')}</ButtonLink>
      </div>
    );
  }
  return <Prompter key={script.id} script={script} role="operator" sid={sid} />;
}

/** A display window opened by an operator tab (`#/s/:id/display/:sid`), e.g. for the glass. */
export function DisplayPage() {
  const t = useT();
  const { id = '', sid = '' } = useParams();
  const { ready, script } = useScript(id);

  if (!ready) return <LoadingScreen label={t('prompter.loading')} />;
  if (!script) {
    return (
      <div className={styles.missing}>
        <p>{t('editor.notFound')}</p>
      </div>
    );
  }
  return (
    <Prompter
      key={script.id}
      script={script}
      role="display"
      sid={/^[0-9a-z]{8,32}$/.test(sid) ? sid : null}
    />
  );
}

interface PrompterProps {
  script: Script;
  role: SyncRole;
  sid: string | null;
}

function Prompter({ script, role, sid }: PrompterProps) {
  const t = useT();
  const fmt = useFormat();
  const navigate = useNavigate();
  const settings = useSettings((s) => s.settings);
  const patch = useSettings((s) => s.patch);
  const updateScript = useLibrary((s) => s.update);
  const { appearance, behavior } = settings;
  const isDisplay = role === 'display';
  const view = isDisplay ? settings.display : settings.view;

  const doc = useMemo(
    () =>
      parseScript(script.body, {
        direction: script.direction,
        fallbackDir: settings.ui.lang === 'ar' ? 'rtl' : 'ltr',
      }),
    [script.body, script.direction, settings.ui.lang],
  );

  const fontFamily = fontStackFor(appearance);
  const lineHeight = effectiveLineHeight(appearance);
  const fontStatus = useScriptFonts(appearance, script.body);
  const layoutKey = [
    fontStatus,
    fontFamily,
    appearance.size,
    appearance.scaleWithWidth,
    appearance.weight,
    lineHeight,
    appearance.wordSpacing,
    appearance.letterSpacing,
    appearance.marginPct,
    appearance.align,
    appearance.hideTashkeel,
    appearance.digits,
    appearance.showNotes,
  ].join('|');

  const config = useMemo<EngineConfig>(
    () => ({
      wpm: behavior.wpm,
      rampMs: behavior.rampMs,
      countdownSec: behavior.countdownSec,
      endBehavior: behavior.endBehavior,
      autoPauseOnCues: behavior.autoPauseOnCues,
      pauseAtMarkers: behavior.pauseAtMarkers,
      headingsSpoken: behavior.headingsSpoken,
      targetDurationSec: behavior.targetDurationSec,
      spokenWords: spokenWords(doc, behavior.headingsSpoken),
      cueSeconds: doc.cues.map((cue) => cue.seconds),
    }),
    [behavior, doc],
  );

  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [stageEl, setStageEl] = useState<HTMLDivElement | null>(null);
  const { engine, status } = usePrompterEngine({
    doc,
    guidePct: appearance.guide.positionPct,
    config,
    viewportRef,
    contentRef,
    layoutKey,
  });

  const [panel, setPanel] = useState<Panel | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [overlayDismissed, setOverlayDismissed] = useState(false);
  const lastGuideStyle = useRef(appearance.guide.style === 'none' ? 'band+arrows' : appearance.guide.style);
  const fullscreen = useFullscreen();
  const playing = status.play === 'playing' || status.play === 'countdown';
  // The display window's welcome card goes away for good once the show starts.
  if (isDisplay && playing && !overlayDismissed) setOverlayDismissed(true);
  const idle = useIdle(2500, (playing || isDisplay) && panel === null);
  const keymap = useMemo(
    () => resolveKeymap(settings.keymap.preset, settings.keymap.overrides),
    [settings.keymap],
  );

  // Resume where the reader stopped last time.
  const resumed = useRef(false);
  useEffect(() => {
    if (resumed.current) return;
    resumed.current = true;
    if (behavior.resumeLastPosition && script.last) engine.jumpToPos(resolveResumePos(doc, script.last));
  }, [engine, behavior.resumeLastPosition, script.last, doc]);

  // Remember the position whenever playback stops, and when leaving the prompter (the window that
  // runs playback does it).
  const savePosition = useCallback(() => {
    if (engine.getMode() !== 'lead') return;
    const current = engine.getStatus();
    if (current.play === 'ended' || current.pos <= 0) {
      if (script.last) updateScript(script.id, { last: undefined }, { touch: false });
      return;
    }
    const pos = engine.getPos();
    updateScript(script.id, { last: { pos, fp: fingerprint(doc, pos) } }, { touch: false });
  }, [engine, doc, script.id, script.last, updateScript]);
  const savePositionRef = useRef(savePosition);
  useEffect(() => {
    savePositionRef.current = savePosition;
  });
  useEffect(() => {
    if (status.play === 'paused' || status.play === 'ended') savePositionRef.current();
  }, [status.play]);
  useEffect(() => () => savePositionRef.current(), []);

  const sync = useSync({
    engine,
    role,
    sid,
    scriptId: script.id,
    onScriptChange: isDisplay
      ? (next) => navigate(`/s/${encodeURIComponent(next)}/display/${sid}`, { replace: true })
      : undefined,
  });
  const displayConnected = sync.peers.some((p) => p.role === 'display');
  const operatorConnected = sync.peers.some((p) => p.role === 'operator');
  // Mirror keys act on the window the talent reads: the display window when there is one.
  const mirrorTarget = isDisplay || displayConnected ? 'display' : 'view';

  const run = useCallback(
    (command: Command) => {
      const current = useSettings.getState().settings;
      switch (command.type) {
        case 'setWpm':
          return patch('behavior', { wpm: clampWpm(command.wpm), targetDurationSec: null });
        case 'nudgeWpm':
          return patch('behavior', {
            wpm: clampWpm(current.behavior.wpm + command.steps * current.behavior.wpmStep),
            targetDurationSec: null,
          });
        case 'toggleMirror': {
          const mirror = current[mirrorTarget];
          return patch(
            mirrorTarget,
            command.axis === 'h' ? { mirrorH: !mirror.mirrorH } : { mirrorV: !mirror.mirrorV },
          );
        }
        case 'nudgeFontSize':
          return patch('appearance', {
            size: Math.min(220, Math.max(20, current.appearance.size + command.steps * 4)),
          });
        case 'toggleHud':
          return patch('appearance', {
            hud: { ...current.appearance.hud, visible: !current.appearance.hud.visible },
          });
        case 'toggleGuide': {
          const style = current.appearance.guide.style;
          if (style !== 'none') lastGuideStyle.current = style;
          return patch('appearance', {
            guide: { ...current.appearance.guide, style: style === 'none' ? lastGuideStyle.current : 'none' },
          });
        }
        case 'toggleFullscreen':
          return fullscreen.toggle();
        case 'help':
          return setHelpOpen((open) => !open);
        case 'exit':
          if (isDisplay) return;
          return navigate(`/s/${script.id}/edit`);
        case 'toggleVoice':
        case 'toggleCamera':
        case 'toggleRecording':
          return;
        default:
          if (isEngineCommand(command)) engine.dispatch(command);
      }
    },
    [engine, patch, fullscreen, navigate, script.id, mirrorTarget, isDisplay],
  );

  useKeymap(keymap, (action) => run(actionCommand(action)));
  useRemoteController({
    enabled: !isDisplay,
    title: script.title,
    doc,
    status,
    fontSize: appearance.size,
    mirror: settings[mirrorTarget],
    canChangeLook: settings.remote.allowSettingChanges,
    onCommand: run,
  });
  const remoteInfo = useRemoteHostInfo();
  useMediaKeys(!isDisplay && settings.remote.mediaKeys, script.title, playing, run);
  useWakeLock(behavior.keepAwake);
  usePointerScroll(stageEl, engine, {
    invert: view.mirrorV,
    wheelAdjustsSpeed: behavior.wheelWhilePlaying === 'speed',
    onSpeedStep: (steps) => run({ type: 'nudgeWpm', steps }),
    onSeekWord: (pos) => run({ type: 'seekPos', pos }),
  });

  const renderOptions = useMemo<RenderOptions>(
    () => ({
      hideTashkeel: appearance.hideTashkeel,
      digits: appearance.digits,
      wordSpans: true,
      cueLabel: (seconds) =>
        seconds ? `${t('prompter.cue')} · ${t('prompter.cueSeconds', { seconds })}` : t('prompter.cue'),
    }),
    [appearance.hideTashkeel, appearance.digits, t],
  );

  const markerTitle = doc.markers[status.marker]?.title ?? null;
  const hud = appearance.hud.visible ? (
    <TalentHud
      dir={settings.ui.lang === 'ar' ? 'rtl' : 'ltr'}
      status={status}
      items={appearance.hud.items}
      markerTitle={markerTitle}
      t={t}
      fmt={fmt}
    />
  ) : null;

  return (
    <div
      className={clsx(styles.page, 'theme-dark')}
      data-idle={idle || undefined}
      data-hide-cursor={(idle && behavior.hideCursor) || undefined}
      data-role={role}
      data-sync={sync.leader ? 'lead' : 'follow'}
      style={{ background: appearance.colors.bg }}
    >
      <div ref={setStageEl} className={styles.stageWrap}>
        <Stage
          doc={doc}
          appearance={appearance}
          mirror={view}
          fontFamily={fontFamily}
          lineHeight={lineHeight}
          status={status}
          renderOptions={renderOptions}
          viewportRef={viewportRef}
          contentRef={contentRef}
          hud={appearance.hud.mirrorWithStage ? hud : null}
          emptyMessage={t('prompter.empty')}
          notice={
            fontStatus === 'loading'
              ? t('fonts.loading')
              : fontStatus === 'fallback'
                ? t('fonts.fallback')
                : null
          }
        />
        {!appearance.hud.mirrorWithStage && hud}
      </div>

      {!isDisplay && (
        <OperatorBar
          status={status}
          wpm={status.wpm}
          markers={doc.markers}
          mirror={settings[mirrorTarget]}
          hidden={idle}
          fullscreen={fullscreen}
          editorHref={`/s/${script.id}/edit`}
          panel={panel}
          displayConnected={displayConnected}
          remoteDevices={remoteInfo.devices.length}
          onCommand={run}
          onPanel={(next) => setPanel((open) => (open === next ? null : next))}
        />
      )}

      {isDisplay && !overlayDismissed && !fullscreen.active && (
        <DisplayOverlay
          connected={operatorConnected}
          fullscreen={fullscreen}
          onDismiss={() => setOverlayDismissed(true)}
        />
      )}

      {panel === 'settings' && (
        <QuickSettings
          script={script}
          rtlDominant={doc.dominantDir === 'rtl'}
          onClose={() => setPanel(null)}
        />
      )}
      {panel === 'remote' && <RemotePanel onClose={() => setPanel(null)} />}
      {panel === 'display' && sid && (
        <DisplayPanel
          scriptId={script.id}
          sid={sid}
          connected={displayConnected}
          onClose={() => setPanel(null)}
        />
      )}

      <HelpDialog open={helpOpen} keymap={keymap} onClose={() => setHelpOpen(false)} />
    </div>
  );
}
