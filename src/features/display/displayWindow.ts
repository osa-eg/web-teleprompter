import { randomId } from '@/storage/ids';

const SID_KEY = 'tp:sid';
let memorySid: string | null = null;

/**
 * Session id of this browser tab: operator and display windows of the same tab talk on
 * `tp:s:<sid>`. Kept in sessionStorage so a reload (or coming back from the editor) reconnects to a
 * display window that is still open.
 */
export function getTabSessionId(): string {
  try {
    const existing = sessionStorage.getItem(SID_KEY);
    if (existing && /^[0-9a-z]{8,32}$/.test(existing)) return existing;
    const sid = randomId(12);
    sessionStorage.setItem(SID_KEY, sid);
    return sid;
  } catch {
    memorySid ??= randomId(12);
    return memorySid;
  }
}

export function displayUrl(scriptId: string, sid: string): string {
  const url = new URL(window.location.href);
  url.hash = `#/s/${encodeURIComponent(scriptId)}/display/${sid}`;
  return url.href;
}

interface Placement {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Bounds of another screen, when the Window Management permission was already granted. */
async function otherScreenPlacement(): Promise<Placement | null> {
  if (!window.getScreenDetails) return null;
  try {
    const status = await navigator.permissions.query({ name: 'window-management' as PermissionName });
    if (status.state !== 'granted') return null;
    const details = await window.getScreenDetails();
    const target = details.screens.find((s) => s !== details.currentScreen);
    if (!target) return null;
    return {
      left: target.availLeft,
      top: target.availTop,
      width: target.availWidth,
      height: target.availHeight,
    };
  } catch {
    return null;
  }
}

let displayWindow: Window | null = null;

function isBlank(win: Window): boolean {
  try {
    return win.location.href === 'about:blank';
  } catch {
    return false; // another origin: not ours to navigate
  }
}

/**
 * Opens (or focuses) the display window for this tab's session. Must be called from a click so the
 * pop-up blocker lets it through; it opens on a second screen when the browser allows it.
 * Returns false when the pop-up was blocked.
 */
export async function openDisplayWindow(scriptId: string, sid: string): Promise<boolean> {
  if (displayWindow && !displayWindow.closed) {
    displayWindow.focus();
    return true;
  }
  const placement = await otherScreenPlacement();
  const features = placement
    ? `popup,left=${placement.left},top=${placement.top},width=${placement.width},height=${placement.height}`
    : 'popup,width=1280,height=720';
  // Opening by name first returns a display window that is already open (e.g. after a reload of
  // this tab) without reloading it.
  const win = window.open('', `tp-display-${sid}`, features);
  if (!win) return false;
  if (isBlank(win)) win.location.replace(displayUrl(scriptId, sid));
  win.focus();
  displayWindow = win;
  return true;
}

/** Asks display windows to close themselves (also works when this tab lost its window handle). */
export const CLOSE_DISPLAY = 'tp:close-display';

export function closeDisplayWindow(sid: string): void {
  if (displayWindow && !displayWindow.closed) displayWindow.close();
  displayWindow = null;
  if (typeof BroadcastChannel === 'undefined') return;
  const channel = new BroadcastChannel(`tp:s:${sid}`);
  channel.postMessage(CLOSE_DISPLAY);
  channel.close();
}

/** Full screen on a screen other than the current one (asks for the Window Management permission). */
export async function fullscreenOnOtherScreen(): Promise<'ok' | 'no-screen' | 'failed'> {
  if (!window.getScreenDetails) return 'failed';
  try {
    const details = await window.getScreenDetails();
    const target = details.screens.find((s) => s !== details.currentScreen);
    if (!target) return 'no-screen';
    await document.documentElement.requestFullscreen({ screen: target, navigationUI: 'hide' });
    return 'ok';
  } catch {
    return 'failed';
  }
}

export const canUseOtherScreens = () => typeof window !== 'undefined' && !!window.getScreenDetails;
