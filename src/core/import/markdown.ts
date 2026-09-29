/**
 * Converts Markdown to teleprompter markup. Headings, bold and emphasis carry over; links, images,
 * code and quotes are reduced to readable text.
 */
export function markdownToMarkup(markdown: string): string {
  let text = markdown.replace(/\r\n?/g, '\n');
  text = text.replace(/^---\n[\s\S]*?\n---\n/, ''); // front matter

  const lines = text.split('\n');
  const out: string[] = [];
  let inFence = false;

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i]!;

    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) {
      out.push(line);
      continue;
    }

    // Setext headings: a line underlined with === or ---.
    const next = lines[i + 1];
    if (line.trim() && next !== undefined && /^\s*(=+|-+)\s*$/.test(next) && !/^\s*[-*+]\s/.test(line)) {
      out.push(`${next.trim().startsWith('=') ? '#' : '##'} ${line.trim()}`);
      i++;
      continue;
    }
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) {
      out.push('');
      continue;
    }

    line = line
      .replace(/^(#{4,6})\s+/, '### ')
      .replace(/^\s*>\s?/, '')
      .replace(/^(\s*)[-*+]\s+(\[[ xX]\]\s+)?/, '$1• ')
      .replace(/!\[([^\]]*)\]\([^)]*\)/g, '')
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/__(?=\S)(.+?)(?<=\S)__/g, '**$1**')
      .replace(/<\/?[a-z][^>]*>/gi, '');
    out.push(line);
  }
  return out
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
