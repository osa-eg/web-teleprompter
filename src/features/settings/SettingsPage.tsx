import { useT } from '@/i18n';
import { useSettings, type UiSettings } from '@/stores/settings';
import { Field, Select } from '@/ui/Field';
import styles from './SettingsPage.module.css';

export function SettingsPage() {
  const t = useT();
  const ui = useSettings((s) => s.settings.ui);
  const patch = useSettings((s) => s.patch);

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>{t('settings.title')}</h1>

      <section className={styles.section} aria-labelledby="settings-interface">
        <h2 id="settings-interface">{t('settings.interface')}</h2>
        <div className={styles.grid}>
          <Field label={t('ui.language')}>
            {(id) => (
              <Select<UiSettings['lang']>
                id={id}
                value={ui.lang}
                onChange={(lang) => patch('ui', { lang })}
                options={[
                  { value: 'ar', label: 'العربية' },
                  { value: 'en', label: 'English' },
                ]}
              />
            )}
          </Field>
          <Field label={t('ui.theme')}>
            {(id) => (
              <Select<UiSettings['theme']>
                id={id}
                value={ui.theme}
                onChange={(theme) => patch('ui', { theme })}
                options={[
                  { value: 'system', label: t('ui.theme.system') },
                  { value: 'dark', label: t('ui.theme.dark') },
                  { value: 'light', label: t('ui.theme.light') },
                ]}
              />
            )}
          </Field>
          {ui.lang === 'ar' && (
            <Field label={t('ui.digits')}>
              {(id) => (
                <Select<UiSettings['digits']>
                  id={id}
                  value={ui.digits}
                  onChange={(digits) => patch('ui', { digits })}
                  options={[
                    { value: 'latn', label: t('ui.digits.latn') },
                    { value: 'arab', label: t('ui.digits.arab') },
                  ]}
                />
              )}
            </Field>
          )}
        </div>
      </section>
    </div>
  );
}
