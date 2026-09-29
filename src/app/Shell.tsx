import { Languages, Library, Monitor, Moon, Settings as SettingsIcon, Sun } from 'lucide-react';
import clsx from 'clsx';
import { NavLink, Outlet } from 'react-router';
import { useT } from '@/i18n';
import { useLibrary } from '@/stores/library';
import { useSettings, type UiSettings } from '@/stores/settings';
import { IconButton } from '@/ui/Button';
import { UpdateToast } from './UpdateToast';
import styles from './Shell.module.css';

const THEME_ORDER: UiSettings['theme'][] = ['system', 'dark', 'light'];
const THEME_ICONS = { system: Monitor, dark: Moon, light: Sun } as const;

/** Header + page area for every route except the full-screen prompter views. */
export function Shell() {
  const t = useT();
  const lang = useSettings((s) => s.settings.ui.lang);
  const theme = useSettings((s) => s.settings.ui.theme);
  const patch = useSettings((s) => s.patch);
  const persistent = useLibrary((s) => s.persistent);

  const ThemeIcon = THEME_ICONS[theme];
  const nextTheme = THEME_ORDER[(THEME_ORDER.indexOf(theme) + 1) % THEME_ORDER.length] ?? 'system';

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <NavLink to="/" className={styles.brand}>
          <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" width={28} height={28} />
          <span>{t('app.name')}</span>
        </NavLink>

        <nav className={styles.nav} aria-label={t('nav.main')}>
          <NavLink to="/" end className={({ isActive }) => clsx(styles.navLink, isActive && styles.active)}>
            <Library size={18} aria-hidden />
            <span>{t('nav.library')}</span>
          </NavLink>
          <NavLink
            to="/settings"
            className={({ isActive }) => clsx(styles.navLink, isActive && styles.active)}
          >
            <SettingsIcon size={18} aria-hidden />
            <span>{t('nav.settings')}</span>
          </NavLink>
        </nav>

        <div className={styles.tools}>
          <button
            type="button"
            className={styles.langToggle}
            aria-label={t('ui.switchLanguageLabel')}
            lang={lang === 'ar' ? 'en' : 'ar'}
            onClick={() => patch('ui', { lang: lang === 'ar' ? 'en' : 'ar' })}
          >
            <Languages size={18} aria-hidden />
            <span>{t('ui.switchLanguage')}</span>
          </button>
          <IconButton
            label={t('ui.themeToggle', { theme: t(`ui.theme.${theme}`) })}
            onClick={() => patch('ui', { theme: nextTheme })}
          >
            <ThemeIcon size={18} aria-hidden />
          </IconButton>
        </div>
      </header>

      {!persistent && (
        <div className={styles.banner} role="alert">
          {t('library.memoryOnly')}
        </div>
      )}

      <main className={styles.main}>
        <Outlet />
      </main>
      <UpdateToast />
    </div>
  );
}
