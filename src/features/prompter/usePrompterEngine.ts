import { useEffect, useLayoutEffect, useState, useSyncExternalStore, type RefObject } from 'react';
import { browserHost, ScrollEngine } from '@/core/engine/ScrollEngine';
import type { EngineConfig, EngineStatus } from '@/core/engine/types';
import type { ScriptDoc } from '@/core/script/ast';
import { DomSurface } from './domSurface';

interface Options {
  doc: ScriptDoc;
  guidePct: number;
  config: EngineConfig;
  viewportRef: RefObject<HTMLElement | null>;
  contentRef: RefObject<HTMLElement | null>;
  /** Changes whenever a setting that affects text layout changes (font, size, margins…). */
  layoutKey: string;
}

/**
 * Creates the scroll engine for a prompter view and keeps its measurements current: on resize, when
 * web fonts finish loading, when the device pixel ratio changes and when layout settings change.
 */
export function usePrompterEngine({ doc, guidePct, config, viewportRef, contentRef, layoutKey }: Options): {
  engine: ScrollEngine;
  status: EngineStatus;
} {
  const [{ engine, surface }] = useState(() => {
    const domSurface = new DomSurface();
    return { surface: domSurface, engine: new ScrollEngine(browserHost, domSurface, config) };
  });

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    const content = contentRef.current;
    if (!viewport || !content) return;
    surface.attach(viewport, content);
    engine.relayout();

    const relayout = () => engine.relayout();
    const resizeObserver = new ResizeObserver(relayout);
    resizeObserver.observe(viewport);
    resizeObserver.observe(content);
    document.fonts?.addEventListener('loadingdone', relayout);

    let dprQuery = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
    const onDprChange = () => {
      dprQuery.removeEventListener('change', onDprChange);
      dprQuery = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
      dprQuery.addEventListener('change', onDprChange);
      relayout();
    };
    dprQuery.addEventListener('change', onDprChange);

    return () => {
      resizeObserver.disconnect();
      document.fonts?.removeEventListener('loadingdone', relayout);
      dprQuery.removeEventListener('change', onDprChange);
      engine.halt();
      surface.detach();
    };
  }, [engine, surface, viewportRef, contentRef]);

  // Re-measure after React has committed a new script or new layout settings.
  useLayoutEffect(() => {
    surface.update(doc, guidePct);
    engine.relayout();
  }, [engine, surface, doc, guidePct, layoutKey]);

  useEffect(() => {
    engine.setConfig(config);
  }, [engine, config]);

  const status = useSyncExternalStore(engine.subscribe, engine.getStatus);
  return { engine, status };
}
