import { z } from 'zod';

export const BACKUP_APP = 'web-teleprompter';
export const BACKUP_VERSION = 1;

const ScriptSchema = z.object({
  id: z.string().min(1).max(100),
  title: z.string().max(1000),
  body: z.string().max(5_000_000),
  direction: z.enum(['auto', 'rtl', 'ltr']).catch('auto'),
  createdAt: z.number(),
  updatedAt: z.number(),
  last: z.object({ pos: z.number(), fp: z.string().max(1000) }).optional(),
});

const FontFaceSchema = z.object({
  weight: z.number().int().min(1).max(1000),
  style: z.enum(['normal', 'italic']),
  format: z.enum(['woff2', 'woff', 'truetype', 'opentype']),
  fileName: z.string().max(300),
  /** Base64-encoded font data. */
  data: z.string(),
});

const FontSchema = z.object({
  id: z.string().min(1).max(100),
  name: z.string().max(300),
  family: z.string().max(300),
  hasArabic: z.boolean(),
  addedAt: z.number(),
  faces: z.array(FontFaceSchema).max(50),
});

export const BackupSchema = z.object({
  app: z.literal(BACKUP_APP),
  version: z.literal(BACKUP_VERSION),
  exportedAt: z.number(),
  scripts: z.array(ScriptSchema).max(10_000),
  settings: z.unknown().optional(),
  fonts: z.array(FontSchema).max(200).optional(),
});

export type Backup = z.infer<typeof BackupSchema>;
export type BackupScript = z.infer<typeof ScriptSchema>;
export type BackupFont = z.infer<typeof FontSchema>;

export function createBackup(scripts: BackupScript[], settings?: unknown, fonts?: BackupFont[]): Backup {
  return {
    app: BACKUP_APP,
    version: BACKUP_VERSION,
    exportedAt: Date.now(),
    scripts,
    ...(settings === undefined ? {} : { settings }),
    ...(fonts?.length ? { fonts } : {}),
  };
}

export type ParsedBackup = { ok: true; backup: Backup } | { ok: false; error: 'json' | 'format' };

export function parseBackup(text: string): ParsedBackup {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: 'json' };
  }
  const parsed = BackupSchema.safeParse(data);
  return parsed.success ? { ok: true, backup: parsed.data } : { ok: false, error: 'format' };
}

export function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

export function base64ToBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}
