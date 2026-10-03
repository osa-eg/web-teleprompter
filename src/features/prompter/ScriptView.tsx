import clsx from 'clsx';
import { memo, type CSSProperties, type ReactNode } from 'react';
import { stripTashkeel, toArabicIndicDigits, toWesternDigits } from '@/core/script/arabic';
import type { Block, Inline, Line, ScriptDoc } from '@/core/script/ast';
import styles from './ScriptView.module.css';

export interface RenderOptions {
  hideTashkeel: boolean;
  digits: 'asTyped' | 'arab' | 'latn';
  /** Wrap each word in a `span[data-w]` (needed for measuring and word tracking). */
  wordSpans: boolean;
  cueLabel: (seconds?: number) => string;
}

function transformText(text: string, options: RenderOptions): string {
  let out = options.hideTashkeel ? stripTashkeel(text) : text;
  if (options.digits === 'arab') out = toArabicIndicDigits(out);
  else if (options.digits === 'latn') out = toWesternDigits(out);
  return out;
}

function renderInlines(nodes: Inline[], options: RenderOptions, keyPrefix: string): ReactNode[] {
  return nodes.map((node, i) => {
    const key = `${keyPrefix}.${i}`;
    switch (node.t) {
      case 'text':
        return node.parts.map((part, j) =>
          typeof part === 'string' ? (
            transformText(part, options)
          ) : options.wordSpans ? (
            <span key={`${key}.${j}`} data-w={part.w}>
              {transformText(part.s, options)}
            </span>
          ) : (
            transformText(part.s, options)
          ),
        );
      case 'strong':
        return <strong key={key}>{renderInlines(node.c, options, key)}</strong>;
      case 'em':
        return <em key={key}>{renderInlines(node.c, options, key)}</em>;
      case 'mark':
        return (
          <mark key={key} className={styles.mark}>
            {renderInlines(node.c, options, key)}
          </mark>
        );
      case 'note':
        return (
          <span key={key} className={styles.note}>
            {renderInlines(node.c, options, key)}
          </span>
        );
      case 'cue':
        return (
          <span key={key} className={styles.cue} data-w={options.wordSpans ? node.w : undefined}>
            {options.cueLabel(node.seconds)}
          </span>
        );
    }
  });
}

function LineView({ line, options, prefix }: { line: Line; options: RenderOptions; prefix: string }) {
  return (
    <div className={styles.line} dir={line.dir}>
      {renderInlines(line.c, options, prefix)}
    </div>
  );
}

/** Blank lines typed before a block, laid out by the stylesheet as empty lines. */
const gapStyle = (gap: number) => (gap > 0 ? ({ '--gap': gap } as CSSProperties) : undefined);

function BlockView({ block, index, options }: { block: Block; index: number; options: RenderOptions }) {
  switch (block.t) {
    case 'heading':
      return (
        <div
          className={clsx(styles.block, styles.heading)}
          style={gapStyle(block.gap)}
          data-block={index}
          data-kind="heading"
          data-level={block.level}
          role="heading"
          aria-level={block.level + 1}
        >
          <LineView line={block.line} options={options} prefix={`${index}`} />
        </div>
      );
    case 'para':
      return (
        <div
          className={clsx(styles.block, styles.para)}
          style={gapStyle(block.gap)}
          data-block={index}
          data-kind="para"
        >
          {block.lines.map((line, i) => (
            <LineView key={i} line={line} options={options} prefix={`${index}.${i}`} />
          ))}
        </div>
      );
    case 'cue':
      return (
        <div
          className={clsx(styles.block, styles.cueBlock)}
          style={gapStyle(block.gap)}
          data-block={index}
          data-kind="cue"
          dir={block.dir}
        >
          <span className={styles.cue} data-w={options.wordSpans ? block.w : undefined}>
            {options.cueLabel(block.seconds)}
          </span>
        </div>
      );
  }
}

/** Renders a parsed script. Memoized: it never re-renders while the prompter scrolls. */
export const ScriptView = memo(function ScriptView({
  doc,
  options,
}: {
  doc: ScriptDoc;
  options: RenderOptions;
}) {
  return (
    <>
      {doc.blocks.map((block, index) => (
        <BlockView key={index} block={block} index={index} options={options} />
      ))}
    </>
  );
});
