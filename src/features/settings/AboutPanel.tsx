import { CATALOG } from '@/features/fonts/catalog';
import { useSettings } from '@/stores/settings';
import { useT } from '@/i18n';
import { Section } from '@/ui/controls';
import styles from './AboutPanel.module.css';

export function AboutPanel() {
  const t = useT();
  const lang = useSettings((s) => s.settings.ui.lang);
  return (
    <>
      <Section title={t('settings.about')}>
        <div className={styles.about}>
          <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" width={56} height={56} />
          <div>
            <h3 className={styles.name}>{t('app.name')}</h3>
            <p className={styles.muted}>{t('about.version', { version: __APP_VERSION__ })}</p>
          </div>
        </div>
        <p>{t('about.description')}</p>
      </Section>
      <Section title={t('about.licenses')}>
        <p className={styles.muted}>{t('about.licensesHint')}</p>
        <details className={styles.details}>
          <summary>{t('fonts.count', { count: CATALOG.length })}</summary>
          <ul className={styles.licenses}>
            {CATALOG.map((font) => (
              <li key={font.id}>
                <strong dir="auto">{font.names[lang]}</strong>{' '}
                <span className={styles.muted}>({font.license})</span>
                <p className={styles.attribution} dir="ltr">
                  {font.attribution}
                </p>
              </li>
            ))}
          </ul>
        </details>
      </Section>
    </>
  );
}
