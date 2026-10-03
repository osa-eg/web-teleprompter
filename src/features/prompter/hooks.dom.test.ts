import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { useWakeLock } from './hooks';

class FakeSentinel {
  released = false;
  release = vi.fn(async () => {
    this.released = true;
  });
}

function mockWakeLock(request: () => Promise<FakeSentinel>) {
  const spy = vi.fn(request);
  Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: { request: spy } });
  return spy;
}

const denied = () => Promise.reject(new DOMException('denied', 'NotAllowedError'));
const granted = async () => new FakeSentinel();

afterEach(() => {
  cleanup();
  Reflect.deleteProperty(navigator, 'wakeLock');
});

describe('useWakeLock', () => {
  it('takes the lock when active and releases it on unmount', async () => {
    const sentinel = new FakeSentinel();
    const request = mockWakeLock(async () => sentinel);
    const { unmount } = renderHook(() => useWakeLock(true));
    await waitFor(() => expect(request).toHaveBeenCalledWith('screen'));
    unmount();
    await waitFor(() => expect(sentinel.release).toHaveBeenCalled());
  });

  it('does nothing when inactive', () => {
    const request = mockWakeLock(granted);
    renderHook(() => useWakeLock(false));
    expect(request).not.toHaveBeenCalled();
  });

  it('retries a denied lock on the next tap (Safari on iPhone wants a gesture)', async () => {
    const request = mockWakeLock(denied);
    renderHook(() => useWakeLock(true));
    await waitFor(() => expect(request).toHaveBeenCalledTimes(1));
    request.mockImplementation(granted);
    window.dispatchEvent(new Event('touchend'));
    await waitFor(() => expect(request).toHaveBeenCalledTimes(2));
    // Held now: further taps do not ask again.
    window.dispatchEvent(new Event('click'));
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));
    await Promise.resolve();
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('takes the lock again after the system released it', async () => {
    const first = new FakeSentinel();
    const request = mockWakeLock(async () => first);
    renderHook(() => useWakeLock(true));
    await waitFor(() => expect(request).toHaveBeenCalledTimes(1));
    first.released = true;
    request.mockImplementation(granted);
    document.dispatchEvent(new Event('visibilitychange'));
    await waitFor(() => expect(request).toHaveBeenCalledTimes(2));
  });

  it('keeps a single lock when one tap fires several gesture events', async () => {
    const request = mockWakeLock(denied);
    renderHook(() => useWakeLock(true));
    await waitFor(() => expect(request).toHaveBeenCalledTimes(1));
    const sentinels: FakeSentinel[] = [];
    request.mockImplementation(async () => {
      const sentinel = new FakeSentinel();
      sentinels.push(sentinel);
      return sentinel;
    });
    window.dispatchEvent(new Event('touchend'));
    window.dispatchEvent(new Event('click'));
    await waitFor(() => expect(sentinels).toHaveLength(2));
    await waitFor(() => expect(sentinels.filter((s) => s.released)).toHaveLength(1));
  });

  it('survives browsers without the API', () => {
    expect(() => renderHook(() => useWakeLock(true)).unmount()).not.toThrow();
  });
});
