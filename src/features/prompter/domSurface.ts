import { EMPTY_MODEL } from '@/core/engine/layout';
import type { EngineSurface, LayoutModel } from '@/core/engine/types';
import type { ScriptDoc } from '@/core/script/ast';

/**
 * Connects the scroll engine to the rendered script: measures token/line/block positions and moves
 * the content with a GPU-composited transform.
 *
 * Positions come from offsetTop/offsetHeight (layout coordinates relative to the positioned content
 * element), which ignore CSS transforms — so mirroring the stage never disturbs measurements.
 */
export class DomSurface implements EngineSurface {
  private viewport: HTMLElement | null = null;
  private content: HTMLElement | null = null;
  doc: ScriptDoc | null = null;
  /** Reading line position, % of the viewport height from the top. */
  guidePct = 33;

  attach(viewport: HTMLElement, content: HTMLElement): void {
    this.viewport = viewport;
    this.content = content;
  }

  /** Sets the script being measured and the reading-line position (% from the top). */
  update(doc: ScriptDoc, guidePct: number): void {
    this.doc = doc;
    this.guidePct = guidePct;
  }

  detach(): void {
    this.viewport = null;
    this.content = null;
  }

  apply(px: number): void {
    if (this.content) this.content.style.transform = `translate3d(0, ${-px}px, 0)`;
  }

  measure(): LayoutModel {
    const { viewport, content, doc } = this;
    if (!viewport || !content || !doc) return EMPTY_MODEL;

    const viewportH = viewport.clientHeight;
    const readingY = (viewportH * this.guidePct) / 100;
    const style = getComputedStyle(content);
    const fontSize = parseFloat(style.fontSize) || 16;
    const lineHeightPx = parseFloat(style.lineHeight) || fontSize * 1.5;

    // Visual lines: runs of tokens sharing (roughly) the same top.
    const tokenEls = content.querySelectorAll<HTMLElement>('[data-w]');
    const tokenCount = tokenEls.length;
    const lineP: number[] = [];
    const lineTok: number[] = [];
    const tokenLine = new Int32Array(tokenCount);
    let lastTop = Number.NEGATIVE_INFINITY;
    for (let i = 0; i < tokenCount; i++) {
      const el = tokenEls[i]!;
      const top = el.offsetTop;
      if (lineP.length === 0 || Math.abs(top - lastTop) > lineHeightPx * 0.5) {
        lineP.push(top + el.offsetHeight / 2 - readingY);
        lineTok.push(i);
        lastTop = top;
      }
      tokenLine[i] = lineP.length - 1;
    }
    // Guard against rounding making consecutive lines non-increasing.
    for (let k = 1; k < lineP.length; k++) {
      if (lineP[k]! <= lineP[k - 1]!) lineP[k] = lineP[k - 1]! + 0.01;
    }
    const tokenP = (token: number) =>
      token >= 0 && token < tokenCount ? lineP[tokenLine[token]!] : undefined;

    // Blocks.
    const blockEls = content.querySelectorAll<HTMLElement>('[data-block]');
    const firstTokenOfBlock = new Int32Array(doc.blocks.length).fill(-1);
    for (const token of doc.tokens) {
      if (firstTokenOfBlock[token.block] === -1) firstTokenOfBlock[token.block] = token.i;
    }
    const blockP = new Float64Array(blockEls.length);
    let paraHeight = 0;
    let headingHeight = 0;
    let textBottom = 0;
    blockEls.forEach((el, b) => {
      const height = el.offsetHeight;
      const kind = el.dataset.kind;
      if (kind === 'para') paraHeight += height;
      else if (kind === 'heading') headingHeight += height;
      blockP[b] =
        tokenP(firstTokenOfBlock[b] ?? -1) ?? el.offsetTop + Math.min(height, lineHeightPx) / 2 - readingY;
      textBottom = Math.max(textBottom, el.offsetTop + height);
    });

    const markerP = Float64Array.from(doc.markers, (m) => tokenP(m.token) ?? blockP[m.block] ?? 0);
    const cueP = Float64Array.from(doc.cues, (c) => tokenP(c.token) ?? blockP[c.block] ?? 0);

    const lastLineP = lineP.length ? lineP[lineP.length - 1]! : 0;
    const endPx = Math.max(0, lastLineP, textBottom - lineHeightPx / 2 - readingY);

    return {
      viewportH,
      readingY,
      dpr: window.devicePixelRatio || 1,
      lineHeightPx,
      tokenCount,
      lineP: Float64Array.from(lineP),
      lineTok: Int32Array.from(lineTok),
      blockP,
      markerP,
      cueP,
      paraHeight,
      headingHeight,
      endPx,
      scrollOutPx: Math.max(endPx, textBottom),
    };
  }
}
