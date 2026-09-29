import clsx from 'clsx';
import type { ReactNode, RefObject } from 'react';
import type { EngineStatus } from '@/core/engine/types';
import type { ScriptDoc } from '@/core/script/ast';
import type { Appearance, ViewSettings } from '@/stores/settingsSchema';
import { ScriptView, type RenderOptions } from './ScriptView';
import { stageStyle } from './stageStyle';
import styles from './Stage.module.css';

function ReadingGuide({ appearance }: { appearance: Appearance }) {
  const { style, dim, bothSides } = appearance.guide;
  const band = style === 'band' || style === 'band+arrows';
  const arrows = style === 'arrows' || style === 'band+arrows';
  return (
    <div className={clsx(styles.overlay, styles.metrics)} aria-hidden>
      {dim > 0 && style !== 'none' && (
        <>
          <div className={styles.dimTop} />
          <div className={styles.dimBottom} />
        </>
      )}
      {appearance.fadeEdges && (
        <>
          <div className={styles.fadeTop} />
          <div className={styles.fadeBottom} />
        </>
      )}
      {band && <div className={styles.band} data-testid="guide-band" />}
      {style === 'line' && <div className={styles.guideLine} />}
      {arrows && <div className={styles.arrowStart} data-testid="guide-arrow" />}
      {arrows && bothSides && <div className={styles.arrowEnd} />}
    </div>
  );
}

interface StageProps {
  doc: ScriptDoc;
  appearance: Appearance;
  mirror: ViewSettings;
  fontFamily: string;
  lineHeight: number;
  status: EngineStatus;
  renderOptions: RenderOptions;
  viewportRef: RefObject<HTMLDivElement | null>;
  contentRef: RefObject<HTMLDivElement | null>;
  /** Talent-facing info drawn inside the (mirrored) stage. */
  hud?: ReactNode;
  emptyMessage?: string;
  className?: string;
}

/**
 * The teleprompter surface: script text, reading guide and talent HUD. Everything inside is mirrored
 * together, so after the beam-splitter reflection the talent sees normal text with the guide arrows
 * on the side where lines begin.
 */
export function Stage({
  doc,
  appearance,
  mirror,
  fontFamily,
  lineHeight,
  status,
  renderOptions,
  viewportRef,
  contentRef,
  hud,
  emptyMessage,
  className,
}: StageProps) {
  return (
    <div
      className={clsx(styles.stage, className)}
      style={stageStyle(appearance, mirror, fontFamily, lineHeight)}
      dir={doc.dominantDir}
      data-testid="stage"
      data-play-state={status.play}
      data-wpm={status.wpm}
      data-pos={status.pos.toFixed(2)}
      data-mirror-h={mirror.mirrorH || undefined}
      data-mirror-v={mirror.mirrorV || undefined}
    >
      <div ref={viewportRef} className={styles.viewport}>
        <div
          ref={contentRef}
          className={clsx(styles.content, styles.metrics)}
          data-testid="stage-content"
          data-align={appearance.align}
          data-notes={appearance.showNotes ? 'visible' : 'hidden'}
        >
          <ScriptView doc={doc} options={renderOptions} />
        </div>
      </div>

      {appearance.guide.style !== 'none' || appearance.fadeEdges ? (
        <ReadingGuide appearance={appearance} />
      ) : null}

      {doc.blocks.length === 0 && emptyMessage && <p className={styles.empty}>{emptyMessage}</p>}

      {hud}

      {status.countdown !== null && (
        <div className={styles.countdown} data-testid="countdown" aria-live="assertive">
          <span key={status.countdown} className={styles.countdownNumber}>
            {status.countdown}
          </span>
        </div>
      )}
    </div>
  );
}
