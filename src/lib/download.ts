/** Saves text as a file through a temporary object URL. */
export function downloadText(fileName: string, text: string, type = 'text/plain;charset=utf-8'): void {
  downloadBlob(fileName, new Blob([text], { type }));
}

/** Saves a blob as a file through a temporary object URL. */
export function downloadBlob(fileName: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  // Large recordings need time to be handed over before the URL goes away.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** A file-name-safe version of a title (keeps Arabic letters). */
export function safeFileName(title: string, fallback = 'script'): string {
  const printable = [...title].filter((char) => char.charCodeAt(0) >= 32).join('');
  const cleaned = printable
    .replace(/[\\/:*?"<>|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
  return cleaned || fallback;
}
