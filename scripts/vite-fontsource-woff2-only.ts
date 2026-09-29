import type { Plugin } from 'vite';

const FONTSOURCE_CSS = /[\\/]@fontsource(?:-variable)?[\\/].+\.css$/;
const WOFF_SOURCE = /,\s*url\([^)]*\.woff\)\s*format\(['"]woff['"]\)/g;

/**
 * Fontsource stylesheets list a WOFF fallback next to every WOFF2 file. Every browser this app
 * supports reads WOFF2, so dropping the fallback halves the font files shipped in the build.
 */
export function fontsourceWoff2Only(): Plugin {
  return {
    name: 'fontsource-woff2-only',
    enforce: 'pre',
    transform(code, id) {
      if (!FONTSOURCE_CSS.test(id)) return null;
      return { code: code.replace(WOFF_SOURCE, ''), map: null };
    },
  };
}
