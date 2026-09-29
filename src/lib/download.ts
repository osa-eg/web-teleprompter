/** Saves text as a file through a temporary object URL. */
export function downloadText(fileName: string, text: string, type = 'text/plain;charset=utf-8'): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
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
