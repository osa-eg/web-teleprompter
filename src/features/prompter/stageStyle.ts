import type { CSSProperties } from 'react';
import type { Appearance, ViewSettings } from '@/stores/settingsSchema';

/** CSS custom properties that drive the stage typography, colors, guide and mirroring. */
export function stageStyle(
  appearance: Appearance,
  mirror: ViewSettings,
  fontFamily: string,
  lineHeight: number,
): CSSProperties {
  const { colors, guide } = appearance;
  return {
    '--tp-font': fontFamily,
    '--tp-size': String(appearance.size),
    '--tp-unit': appearance.scaleWithWidth ? 'calc(100cqi / 1280)' : '1px',
    '--tp-weight': String(appearance.weight),
    '--tp-lh': String(lineHeight),
    '--tp-ws': `${appearance.wordSpacing}em`,
    '--tp-ls': `${appearance.letterSpacing}em`,
    '--tp-margin': `${appearance.marginPct}%`,
    '--tp-align': appearance.align,
    '--tp-fg': colors.fg,
    '--tp-bg': colors.bg,
    '--tp-mark': colors.mark,
    '--tp-note': colors.note,
    '--tp-cue': colors.cue,
    '--tp-guide': colors.guide,
    '--tp-em': colors.em,
    '--tp-reading': String(guide.positionPct),
    '--tp-dim': String(guide.dim),
    '--mx': mirror.mirrorH ? '-1' : '1',
    '--my': mirror.mirrorV ? '-1' : '1',
  } as CSSProperties;
}
