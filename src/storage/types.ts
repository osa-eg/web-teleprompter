export type TextDirSetting = 'auto' | 'rtl' | 'ltr';

export interface Script {
  id: string;
  title: string;
  /** Script source in the teleprompter markup (see core/script/parse.ts). */
  body: string;
  /** `auto` detects the direction of every line from its words. */
  direction: TextDirSetting;
  createdAt: number;
  updatedAt: number;
  /** Last reading position: positional token index + fingerprint of nearby words. */
  last?: { pos: number; fp: string };
}

export interface CustomFontFace {
  weight: number;
  style: 'normal' | 'italic';
  format: 'woff2' | 'woff' | 'truetype' | 'opentype';
  fileName: string;
  data: ArrayBuffer;
}

export interface CustomFontRecord {
  id: string;
  /** Name shown to the user. */
  name: string;
  /** Internal, collision-free CSS family name (`tp-u-<id>`). */
  family: string;
  hasArabic: boolean;
  addedAt: number;
  faces: CustomFontFace[];
}
