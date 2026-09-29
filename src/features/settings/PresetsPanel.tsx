import { Save, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { fontStackFor } from '@/features/fonts/fontSettings';
import { useT } from '@/i18n';
import { randomId } from '@/storage/ids';
import { useSettings } from '@/stores/settings';
import { Button, IconButton } from '@/ui/Button';
import { Section } from '@/ui/controls';
import { toast } from '@/ui/toast';
import styles from './PresetsPanel.module.css';

/** Saved "looks": font, colors, guide and mirroring that can be re-applied in one click. */
export function PresetsPanel() {
  const t = useT();
  const presets = useSettings((s) => s.settings.presets);
  const update = useSettings((s) => s.update);
  const [name, setName] = useState('');

  const save = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    update((s) => ({
      ...s,
      presets: [
        ...s.presets,
        { id: randomId(8), name: trimmed, appearance: s.appearance, view: s.view },
      ].slice(-50),
    }));
    setName('');
  };

  return (
    <Section title={t('settings.presets')}>
      <form
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault();
          save();
        }}
      >
        <input
          value={name}
          dir="auto"
          aria-label={t('presets.name')}
          placeholder={t('presets.name')}
          maxLength={80}
          onChange={(e) => setName(e.currentTarget.value)}
        />
        <Button type="submit" size="sm" icon={<Save size={16} aria-hidden />} disabled={!name.trim()}>
          {t('presets.save')}
        </Button>
      </form>
      {presets.length === 0 ? (
        <p className={styles.empty}>{t('presets.empty')}</p>
      ) : (
        <ul className={styles.list}>
          {presets.map((preset) => (
            <li key={preset.id} className={styles.item}>
              <span
                className={styles.sample}
                style={{
                  background: preset.appearance.colors.bg,
                  color: preset.appearance.colors.fg,
                  fontFamily: fontStackFor(preset.appearance),
                  fontWeight: preset.appearance.weight,
                }}
                aria-hidden
              >
                أبجد Aa
              </span>
              <span className={styles.name} dir="auto">
                {preset.name}
              </span>
              <Button
                size="sm"
                onClick={() => {
                  update((s) => ({ ...s, appearance: preset.appearance, view: preset.view }));
                  toast({ message: t('presets.applied', { name: preset.name }), tone: 'success' });
                }}
              >
                {t('presets.apply')}
              </Button>
              <IconButton
                size="sm"
                label={t('action.delete')}
                onClick={() =>
                  update((s) => ({ ...s, presets: s.presets.filter((p) => p.id !== preset.id) }))
                }
              >
                <Trash2 size={16} aria-hidden />
              </IconButton>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
