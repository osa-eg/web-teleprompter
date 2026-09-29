export type FontCategory =
  'sans' | 'kufi' | 'naskh' | 'ruqaa' | 'nastaliq' | 'display' | 'handwriting' | 'serif' | 'mono';

export interface CatalogFont {
  id: string;
  /** CSS font-family name ("Cairo Variable" for variable packages). */
  family: string;
  pkg: string;
  names: { ar: string; en: string };
  scripts: ('arabic' | 'latin')[];
  category: FontCategory;
  weights: number[];
  variable: { min: number; max: number } | null;
  /** Recommended line height (taller for scripts with diacritics). */
  lineHeight: number;
  recommended: boolean;
  license: string;
  attribution: string;
  /** Stylesheet loaders: `wght` for variable fonts, otherwise one per weight. */
  load: Record<string, () => Promise<unknown>>;
}
