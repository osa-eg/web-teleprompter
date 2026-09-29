import { useState } from 'react';
import { useT } from '@/i18n';
import { useFonts } from '@/stores/fonts';
import { useSettings, type FontRef } from '@/stores/settings';
import { Button } from '@/ui/Button';
import { catalogFont, nearestWeight } from './catalog';
import { fontDisplayName, resolveFamily, weightOptions } from './fontSettings';
import { FontPicker, type FontPickerMode } from './FontPicker';
import { FontPreview } from './FontPreview';
import styles from './FontField.module.css';

/** Shows the chosen font with a preview and opens the font picker. */
export function FontField({ mode = 'primary' }: { mode?: FontPickerMode }) {
  const t = useT();
  const lang = useSettings((s) => s.settings.ui.lang);
  const appearance = useSettings((s) => s.settings.appearance);
  const patch = useSettings((s) => s.patch);
  useFonts((s) => s.custom); // re-render when uploaded fonts (and their names) change
  const [open, setOpen] = useState(false);
  const value = mode === 'primary' ? appearance.font : appearance.latinFont;

  const apply = (ref: FontRef | null) => {
    if (mode === 'latin') {
      patch('appearance', { latinFont: ref });
      return;
    }
    if (!ref) return;
    // Keep the weight valid for the new font.
    const options = weightOptions(ref);
    const weight = Array.isArray(options)
      ? nearestWeight(options, appearance.weight)
      : Math.min(options.max, Math.max(options.min, appearance.weight));
    patch('appearance', { font: ref, weight });
  };

  const family = value ? resolveFamily(value) : null;
  const arabicSample =
    value?.kind === 'catalog' ? catalogFont(value.id)?.scripts.includes('arabic') : mode === 'primary';

  return (
    <div className={styles.field}>
      <span className={styles.label}>{mode === 'primary' ? t('qs.font') : t('qs.latinFont')}</span>
      <div className={styles.current}>
        <div className={styles.info}>
          <span className={styles.name} dir="auto" data-testid={`font-field-${mode}`}>
            {value ? fontDisplayName(value, lang) : t('fonts.none')}
          </span>
          {value && family && (
            <FontPreview
              fontRef={value}
              family={family}
              text={arabicSample ? t('fonts.sampleArabic') : t('fonts.sampleLatin')}
              className={styles.preview}
            />
          )}
        </div>
        <Button size="sm" onClick={() => setOpen(true)}>
          {t('fonts.change')}
        </Button>
      </div>
      {open && <FontPicker mode={mode} value={value} onSelect={apply} onClose={() => setOpen(false)} />}
    </div>
  );
}
