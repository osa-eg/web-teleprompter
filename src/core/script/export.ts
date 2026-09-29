import type { Inline, ScriptDoc } from './ast';
import { plainText } from './parse';

function spokenText(nodes: Inline[]): string {
  let out = '';
  for (const node of nodes) {
    if (node.t === 'text') for (const part of node.parts) out += typeof part === 'string' ? part : part.s;
    else if (node.t === 'strong' || node.t === 'em' || node.t === 'mark') out += spokenText(node.c);
  }
  return out;
}

/**
 * Plain text of a script without markup, notes or cues: headings become plain lines and paragraphs
 * keep their line breaks.
 */
export function docToPlainText(doc: ScriptDoc): string {
  const blocks: string[] = [];
  for (const block of doc.blocks) {
    if (block.t === 'heading') blocks.push(plainText(block.line.c).trim());
    else if (block.t === 'para') {
      const text = block.lines
        .map((line) => spokenText(line.c).replace(/\s+/g, ' ').trim())
        .filter(Boolean)
        .join('\n');
      if (text) blocks.push(text);
    }
  }
  return blocks.join('\n\n');
}
