import { parseBackup, type Backup } from '@/core/import/backup';
import { convertPresentationForms } from '@/core/import/cleanup';
import { htmlToMarkup } from '@/core/import/htmlToMarkup';
import { markdownToMarkup } from '@/core/import/markdown';
import { decodeText, titleFromFileName } from '@/core/import/text';

export type ImportResult =
  | { kind: 'script'; title: string; body: string; legacyEncoding: boolean }
  | { kind: 'backup'; backup: Backup }
  | { kind: 'error'; reason: 'unsupported' | 'invalid' };

export const IMPORT_ACCEPT = [
  '.txt',
  '.md',
  '.markdown',
  '.docx',
  '.html',
  '.htm',
  '.json',
  'text/plain',
  'text/markdown',
  'text/html',
  'application/json',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
].join(',');

const clean = (text: string) => convertPresentationForms(text.replace(/\r\n?/g, '\n')).trim();

/** Reads a dropped or chosen file into a script (or a backup to restore). */
export async function readImportFile(file: File): Promise<ImportResult> {
  const ext = /\.([a-z0-9]+)$/i.exec(file.name)?.[1]?.toLowerCase() ?? '';
  const title = titleFromFileName(file.name);
  try {
    if (ext === 'docx') {
      const { default: mammoth } = await import('mammoth');
      const { value } = await mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() });
      return { kind: 'script', title, body: clean(htmlToMarkup(value)), legacyEncoding: false };
    }
    const { text, encoding } = decodeText(new Uint8Array(await file.arrayBuffer()));
    const legacyEncoding = encoding === 'windows-1256';
    if (ext === 'json') {
      const parsed = parseBackup(text);
      return parsed.ok ? { kind: 'backup', backup: parsed.backup } : { kind: 'error', reason: 'invalid' };
    }
    if (ext === 'md' || ext === 'markdown') {
      return { kind: 'script', title, body: clean(markdownToMarkup(text)), legacyEncoding };
    }
    if (ext === 'html' || ext === 'htm') {
      return { kind: 'script', title, body: clean(htmlToMarkup(text)), legacyEncoding };
    }
    if (ext === 'txt' || !ext || file.type.startsWith('text/')) {
      return { kind: 'script', title, body: clean(text), legacyEncoding };
    }
    return { kind: 'error', reason: 'unsupported' };
  } catch {
    return { kind: 'error', reason: 'invalid' };
  }
}
