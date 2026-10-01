import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { REPEATABLE, type ActionId } from '@/core/keymap/actions';
import { isEditableTarget, matchAction } from '@/core/keymap/match';
import type { Keymap } from '@/core/keymap/presets';
import type { ScrollEngine } from '@/core/engine/ScrollEngine';

/** Keeps the screen awake while `active` (re-acquired when the page becomes visible again). */
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return;
    let sentinel: WakeLockSentinel | null = null;
    let disposed = false;
    const request = async () => {
      try {
        const lock = await navigator.wakeLock.request('screen');
        if (disposed) void lock.release();
        else sentinel = lock;
      } catch {
        // Denied (e.g. battery saver or not visible): the prompter still works.
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible' && (!sentinel || sentinel.released)) void request();
    };
    void request();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      disposed = true;
      document.removeEventListener('visibilitychange', onVisibility);
      void sentinel?.release().catch(() => undefined);
    };
  }, [active]);
}

/** Safari before 16.4 (macOS, iPadOS) only has the prefixed Fullscreen API. */
interface WebkitDocument extends Document {
  webkitFullscreenEnabled?: boolean;
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => void;
}

interface WebkitElement extends HTMLElement {
  webkitRequestFullscreen?: () => void;
}

function fullscreenElement(): Element | null {
  return document.fullscreenElement ?? (document as WebkitDocument).webkitFullscreenElement ?? null;
}

function subscribeFullscreen(callback: () => void) {
  document.addEventListener('fullscreenchange', callback);
  document.addEventListener('webkitfullscreenchange', callback);
  return () => {
    document.removeEventListener('fullscreenchange', callback);
    document.removeEventListener('webkitfullscreenchange', callback);
  };
}

/**
 * Safari on iPhone cannot put a web page in full screen; added to the Home Screen, the app opens
 * without browser bars instead (true here only while it still runs in the browser).
 */
function iphoneBrowser(): boolean {
  if (typeof navigator === 'undefined' || !/iPhone|iPod/.test(navigator.userAgent)) return false;
  const standalone =
    (navigator as Navigator & { standalone?: boolean }).standalone === true ||
    window.matchMedia?.('(display-mode: standalone), (display-mode: fullscreen)').matches;
  return !standalone;
}

export function useFullscreen() {
  const active = useSyncExternalStore(subscribeFullscreen, () => fullscreenElement() !== null);
  const doc = typeof document === 'undefined' ? null : (document as WebkitDocument);
  const supported = !!doc && (doc.fullscreenEnabled || doc.webkitFullscreenEnabled === true);
  const toggle = useCallback(() => {
    const webkit = document as WebkitDocument;
    if (fullscreenElement()) {
      if (document.exitFullscreen) void document.exitFullscreen().catch(() => undefined);
      else webkit.webkitExitFullscreen?.();
      return;
    }
    const root = document.documentElement as WebkitElement;
    if (root.requestFullscreen) void root.requestFullscreen({ navigationUI: 'hide' }).catch(() => undefined);
    else root.webkitRequestFullscreen?.();
  }, []);
  /** No full screen here, but the iPhone guide (Add to Home Screen) helps. */
  const iphoneHelp = !supported && iphoneBrowser();
  return { supported, active, toggle, iphoneHelp };
}

/** Live result of a CSS media query. */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (callback: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener('change', callback);
      return () => list.removeEventListener('change', callback);
    },
    [query],
  );
  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches);
}

/** True after `ms` without pointer/keyboard activity (used to hide controls and the cursor). */
export function useIdle(ms: number, enabled: boolean): boolean {
  const [idle, setIdle] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    let timer = setTimeout(() => setIdle(true), ms);
    const wake = () => {
      setIdle(false);
      clearTimeout(timer);
      timer = setTimeout(() => setIdle(true), ms);
    };
    const events = ['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart'] as const;
    for (const event of events) window.addEventListener(event, wake, { passive: true });
    return () => {
      clearTimeout(timer);
      for (const event of events) window.removeEventListener(event, wake);
    };
  }, [ms, enabled]);
  return enabled && idle;
}

/**
 * Routes key presses to prompter actions. Matches physical keys, ignores typing in form fields and
 * IME composition, and swallows the key's default behavior (e.g. Space pressing a focused button).
 */
export function useKeymap(keymap: Keymap, onAction: (action: ActionId) => void, enabled = true): void {
  const keymapRef = useRef(keymap);
  const actionRef = useRef(onAction);
  useEffect(() => {
    keymapRef.current = keymap;
    actionRef.current = onAction;
  });
  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing || isEditableTarget(event.target)) return;
      if (document.querySelector('dialog[open]')) return; // a modal dialog owns the keyboard
      const action = matchAction(keymapRef.current, event);
      if (!action) return;
      event.preventDefault();
      if (event.repeat && !REPEATABLE.has(action)) return;
      actionRef.current(action);
    };
    window.addEventListener('keydown', onKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true });
  }, [enabled]);
}

interface PointerOptions {
  /** Vertical mirroring inverts drag and wheel directions. */
  invert: boolean;
  wheelAdjustsSpeed: boolean;
  onSpeedStep: (steps: number) => void;
  onSeekWord: (pos: number) => void;
}

/**
 * Wheel/trackpad scrolling, drag-to-scroll with fling on touch and mouse, and double-click on a
 * word to jump to it.
 */
export function usePointerScroll(
  target: HTMLElement | null,
  engine: ScrollEngine,
  options: PointerOptions,
): void {
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  });

  useEffect(() => {
    if (!target) return;
    const sign = () => (optionsRef.current.invert ? -1 : 1);

    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey) return; // pinch-zoom
      event.preventDefault();
      const status = engine.getStatus();
      const { lineHeightPx, viewportH } = engine.getModel();
      const unit = event.deltaMode === 1 ? lineHeightPx : event.deltaMode === 2 ? viewportH : 1;
      const delta = event.deltaY * unit;
      if (optionsRef.current.wheelAdjustsSpeed && status.play === 'playing') {
        optionsRef.current.onSpeedStep(delta > 0 ? 1 : -1);
        return;
      }
      engine.wheel(delta * sign());
    };

    let pointerId: number | null = null;
    let lastY = 0;
    let dragging = false;
    let samples: { t: number; y: number }[] = [];

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0 || pointerId !== null) return;
      pointerId = event.pointerId;
      lastY = event.clientY;
      dragging = false;
      samples = [{ t: event.timeStamp, y: event.clientY }];
    };
    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerId !== pointerId) return;
      const dy = event.clientY - lastY;
      if (!dragging && Math.abs(event.clientY - samples[0]!.y) > 6) {
        dragging = true;
        target.setPointerCapture(event.pointerId);
        engine.dragStart();
      }
      if (dragging) {
        engine.dragMove(-dy * sign());
        samples.push({ t: event.timeStamp, y: event.clientY });
        const cutoff = event.timeStamp - 100;
        while (samples.length > 2 && samples[0]!.t < cutoff) samples.shift();
      }
      lastY = event.clientY;
    };
    const onPointerUp = (event: PointerEvent) => {
      if (event.pointerId !== pointerId) return;
      pointerId = null;
      if (!dragging) return;
      dragging = false;
      const first = samples[0]!;
      const last = samples[samples.length - 1]!;
      const dt = (last.t - first.t) / 1000;
      const velocity = dt > 0.01 ? (-(last.y - first.y) / dt) * sign() : 0;
      engine.dragEnd(event.type === 'pointercancel' ? 0 : velocity);
    };
    const onDoubleClick = (event: MouseEvent) => {
      const word = (event.target as HTMLElement).closest?.('[data-w]');
      const index = word ? Number((word as HTMLElement).dataset.w) : Number.NaN;
      if (Number.isFinite(index)) optionsRef.current.onSeekWord(index);
    };

    target.addEventListener('wheel', onWheel, { passive: false });
    target.addEventListener('pointerdown', onPointerDown);
    target.addEventListener('pointermove', onPointerMove);
    target.addEventListener('pointerup', onPointerUp);
    target.addEventListener('pointercancel', onPointerUp);
    target.addEventListener('dblclick', onDoubleClick);
    return () => {
      target.removeEventListener('wheel', onWheel);
      target.removeEventListener('pointerdown', onPointerDown);
      target.removeEventListener('pointermove', onPointerMove);
      target.removeEventListener('pointerup', onPointerUp);
      target.removeEventListener('pointercancel', onPointerUp);
      target.removeEventListener('dblclick', onDoubleClick);
    };
  }, [target, engine]);
}
