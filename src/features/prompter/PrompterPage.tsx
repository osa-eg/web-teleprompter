import clsx from 'clsx';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { LoadingScreen } from '@/app/LoadingScreen';
import { isEngineCommand, type Command } from '@/core/commands/types';
import { fingerprint, resolveResumePos } from '@/core/engine/resume';
import { clampWpm } from '@/core/engine/speed';
import type { EngineConfig } from '@/core/engine/types';
import { actionCommand } from '@/core/keymap/actions';
import { resolveKeymap } from '@/core/keymap/presets';
import { spokenWords } from '@/core/script/ast';
import { parseScript } from '@/core/script/parse';
import { effectiveLineHeight, fontStackFor } from '@/features/fonts/fontSettings';
import { useScriptFonts } from '@/features/fonts/useScriptFonts';
import { useFormat, useT } from '@/i18n';
import type { Script } from '@/storage/types';
import { useLibrary } from '@/stores/library';
import { useSettings } from '@/stores/settings';
import { ButtonLink } from '@/ui/Button';
import { HelpDialog } from './HelpDialog';
import { useFullscreen, useIdle, useKeymap, usePointerScroll, useWakeLock } from './hooks';
import { OperatorBar } from './OperatorBar';
import { QuickSettings } from './QuickSettings';
import type { RenderOptions } from './ScriptView';
import { Stage } from './Stage';
import { TalentHud } from './TalentHud';
import { usePrompterEngine } from './usePrompterEngine';
import styles from './PrompterPage.module.css';

export function PrompterPage() {
  const t = useT();
  const { id = '' } = useParams();
  const status = useLibrary((s) => s.status);
  const script = useLibrary((s) => s.scripts.find((x) => x.id === id));

  if (status !== 'ready') return <LoadingScreen label={t('prompter.loading')} />;
  if (!script) {
    return (
      <div className={styles.missing}>
        <p>{t('editor.notFound')}</p>
        <ButtonLink to="/">{t('error.backToLibrary')}</ButtonLink>
      </div>
    );
  }
  return <Prompter key={script.id} script={script} />;
}

function Prompter({ script }: { script: Script }) {
  const t = useT();
  const fmt = useFormat();
  const navigate = useNavigate();
  const settings = useSettings((s) => s.settings);
  const patch = useSettings((s) => s.patch);
  const updateScript = useLibrary((s) => s.update);
  const { appearance, behavior, view } = settings;

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

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const lastGuideStyle = useRef(appearance.guide.style === 'none' ? 'band+arrows' : appearance.guide.style);
  const fullscreen = useFullscreen();
  const playing = status.play === 'playing' || status.play === 'countdown';
  const idle = useIdle(2500, playing && !settingsOpen);
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

  // Remember the position whenever playback stops, and when leaving the prompter.
  const savePosition = useCallback(() => {
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
        case 'toggleMirror':
          return patch(
            'view',
            command.axis === 'h' ? { mirrorH: !current.view.mirrorH } : { mirrorV: !current.view.mirrorV },
          );
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
          return navigate(`/s/${script.id}/edit`);
        case 'toggleVoice':
        case 'toggleCamera':
        case 'toggleRecording':
          return;
        default:
          if (isEngineCommand(command)) engine.dispatch(command);
      }
    },
    [engine, patch, fullscreen, navigate, script.id],
  );

  useKeymap(keymap, (action) => run(actionCommand(action)));
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

      <OperatorBar
        status={status}
        wpm={status.wpm}
        markers={doc.markers}
        mirror={view}
        hidden={idle}
        fullscreen={fullscreen}
        editorHref={`/s/${script.id}/edit`}
        settingsOpen={settingsOpen}
        onCommand={run}
        onToggleSettings={() => setSettingsOpen((open) => !open)}
      />

      {settingsOpen && (
        <QuickSettings
          script={script}
          rtlDominant={doc.dominantDir === 'rtl'}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      <HelpDialog open={helpOpen} keymap={keymap} onClose={() => setHelpOpen(false)} />
    </div>
  );
}
