import {
  base64ToBuffer,
  bufferToBase64,
  createBackup,
  type Backup,
  type BackupFont,
} from '@/core/import/backup';
import { openFontsRepo } from '@/storage/fontsRepo';
import { randomId } from '@/storage/ids';
import { useFonts } from '@/stores/fonts';
import { useLibrary } from '@/stores/library';
import { sanitizeSettings, useSettings } from '@/stores/settings';

/** Builds a backup of every script and the settings, optionally with uploaded fonts. */
export async function buildBackup(includeFonts: boolean): Promise<Backup> {
  const library = useLibrary.getState();
  await library.init();
  await library.flush();
  let fonts: BackupFont[] | undefined;
  if (includeFonts) {
    const repo = await openFontsRepo();
    fonts = (await repo.list()).map((record) => ({
      ...record,
      faces: record.faces.map((face) => ({ ...face, data: bufferToBase64(face.data) })),
    }));
  }
  return createBackup(useLibrary.getState().scripts, useSettings.getState().settings, fonts);
}

/**
 * Restores a backup. Scripts are added as new copies (existing scripts are never overwritten);
 * settings are replaced only when asked; fonts are added unless already present.
 */
export async function restoreBackup(backup: Backup, options: { settings: boolean }): Promise<number> {
  const library = useLibrary.getState();
  await library.init();
  for (const script of backup.scripts) {
    await library.restore({ ...script, id: randomId() });
  }
  if (options.settings && backup.settings !== undefined) {
    const current = useSettings.getState().settings;
    useSettings.setState({ settings: sanitizeSettings(backup.settings, current) });
  }
  if (backup.fonts?.length) {
    const repo = await openFontsRepo();
    for (const font of backup.fonts) {
      if (await repo.get(font.id)) continue;
      await repo.put({
        ...font,
        faces: font.faces.map((face) => ({ ...face, data: base64ToBuffer(face.data) })),
      });
    }
    await useFonts.getState().reload();
  }
  return backup.scripts.length;
}
