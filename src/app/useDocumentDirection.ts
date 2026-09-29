import { useEffect } from 'react';
import { useSettings } from '@/stores/settings';

const THEME_COLORS = { dark: '#0f1115', light: '#f5f6f8' } as const;

/**
 * Keeps <html lang dir data-theme> in sync with the interface settings. index.html sets the same
 * attributes before first paint; this hook takes over once React is running.
 */
export function useDocumentDirection(): void {
  const lang = useSettings((s) => s.settings.ui.lang);
  const theme = useSettings((s) => s.settings.ui.theme);

  useEffect(() => {
    const root = document.documentElement;
    root.lang = lang;
    root.dir = lang === 'ar' ? 'rtl' : 'ltr';
  }, [lang]);

  useEffect(() => {
    const query = window.matchMedia('(prefers-color-scheme: light)');
    const apply = () => {
      const resolved = theme === 'system' ? (query.matches ? 'light' : 'dark') : theme;
      document.documentElement.dataset.theme = resolved;
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[resolved]);
    };
    apply();
    if (theme !== 'system') return;
    query.addEventListener('change', apply);
    return () => query.removeEventListener('change', apply);
  }, [theme]);
}
