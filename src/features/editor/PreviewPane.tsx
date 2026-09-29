import clsx from 'clsx';
import { useMemo, type CSSProperties } from 'react';
import type { ScriptDoc } from '@/core/script/ast';
import { effectiveLineHeight, fontStackFor } from '@/features/fonts/fontSettings';
import { ScriptView, type RenderOptions } from '@/features/prompter/ScriptView';
import { stageStyle } from '@/features/prompter/stageStyle';
import { useT } from '@/i18n';
import { useSettings } from '@/stores/settings';
import styles from './PreviewPane.module.css';

/** Static preview of the parsed script with the prompter's font, colors and direction rules. */
export function PreviewPane({ doc, className }: { doc: ScriptDoc; className?: string }) {
  const t = useT();
  const appearance = useSettings((s) => s.settings.appearance);
  const options = useMemo<RenderOptions>(
    () => ({
      hideTashkeel: appearance.hideTashkeel,
      digits: appearance.digits,
      wordSpans: false,
      cueLabel: (seconds) =>
        seconds ? `${t('prompter.cue')} · ${t('prompter.cueSeconds', { seconds })}` : t('prompter.cue'),
    }),
    [appearance.hideTashkeel, appearance.digits, t],
  );

  const style = {
    ...stageStyle(
      appearance,
      { mirrorH: false, mirrorV: false },
      fontStackFor(appearance),
      effectiveLineHeight(appearance),
    ),
    '--tp-size': '26',
    '--tp-unit': '1px',
  } as CSSProperties;

  return (
    <section className={clsx(styles.preview, className)} aria-label={t('editor.preview')} style={style}>
      <div
        className={styles.text}
        dir={doc.dominantDir}
        data-align={appearance.align}
        data-notes={appearance.showNotes ? 'visible' : 'hidden'}
        data-testid="preview"
      >
        <ScriptView doc={doc} options={options} />
      </div>
    </section>
  );
}
