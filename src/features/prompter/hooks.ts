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

function subscribeFullscreen(callback: () => void) {
  document.addEventListener('fullscreenchange', callback);
  return () => document.removeEventListener('fullscreenchange', callback);
}

export function useFullscreen() {
  const active = useSyncExternalStore(subscribeFullscreen, () => document.fullscreenElement !== null);
  const supported = typeof document !== 'undefined' && document.fullscreenEnabled;
  const toggle = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    else void document.documentElement.requestFullscreen({ navigationUI: 'hide' }).catch(() => undefined);
  }, []);
  return { supported, active, toggle };
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
