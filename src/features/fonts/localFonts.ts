/**
 * Lists fonts installed on this computer via the Local Font Access API (Chromium desktop only).
 * Requires a user gesture and the "local-fonts" permission; unavailable in iframes and other browsers.
 */
export function localFontsSupported(): boolean {
  return (
    typeof window !== 'undefined' && typeof window.queryLocalFonts === 'function' && window.isSecureContext
  );
}

export async function queryLocalFamilies(): Promise<string[]> {
  if (!window.queryLocalFonts) return [];
  const fonts = await window.queryLocalFonts();
  const families = new Set<string>();
  for (const font of fonts) families.add(font.family);
  return [...families].sort((a, b) => a.localeCompare(b));
}
