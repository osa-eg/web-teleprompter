export interface DecodedText {
  text: string;
  encoding: 'utf-8' | 'utf-16le' | 'utf-16be' | 'windows-1256';
}

/**
 * Decodes a text file: byte-order marks first, then strict UTF-8, then Windows-1256 — the legacy
 * Arabic encoding of many files saved by older Windows editors (they turn into mojibake otherwise).
 */
export function decodeText(bytes: Uint8Array): DecodedText {
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return { text: new TextDecoder('utf-8').decode(bytes.subarray(3)), encoding: 'utf-8' };
  }
  if (bytes[0] === 0xff && bytes[1] === 0xfe) {
    return { text: new TextDecoder('utf-16le').decode(bytes.subarray(2)), encoding: 'utf-16le' };
  }
  if (bytes[0] === 0xfe && bytes[1] === 0xff) {
    return { text: new TextDecoder('utf-16be').decode(bytes.subarray(2)), encoding: 'utf-16be' };
  }
  try {
    return { text: new TextDecoder('utf-8', { fatal: true }).decode(bytes), encoding: 'utf-8' };
  } catch {
    return { text: new TextDecoder('windows-1256').decode(bytes), encoding: 'windows-1256' };
  }
}

/** Title for an imported file: its name without the extension. */
export function titleFromFileName(name: string): string {
  return (
    name
      .replace(/\.[^.]+$/, '')
      .replace(/[_]+/g, ' ')
      .trim() || name
  );
}
