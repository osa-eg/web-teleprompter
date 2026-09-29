import { useEffect, useState } from 'react';

export type CameraStatus = 'off' | 'starting' | 'ready' | 'denied' | 'unavailable' | 'error';

/**
 * The camera (with the microphone, for recording) while `active`. Tracks stop as soon as it is not
 * needed, so the camera light goes off.
 */
export function useCameraStream(active: boolean, deviceId: string | null) {
  const [state, setState] = useState<{ stream: MediaStream | null; status: CameraStatus }>({
    stream: null,
    status: 'off',
  });

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    let stream: MediaStream | null = null;
    const start = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setState({ stream: null, status: 'unavailable' });
        return;
      }
      setState({ stream: null, status: 'starting' });
      const video: MediaTrackConstraints = {
        width: { ideal: 1920 },
        height: { ideal: 1080 },
        ...(deviceId ? { deviceId: { exact: deviceId } } : { facingMode: 'user' }),
      };
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video, audio: true });
      } catch (error) {
        const name = error instanceof DOMException ? error.name : '';
        if (!cancelled) {
          setState({
            stream: null,
            status:
              name === 'NotAllowedError' ? 'denied' : name === 'NotFoundError' ? 'unavailable' : 'error',
          });
        }
        return;
      }
      if (cancelled) stream.getTracks().forEach((track) => track.stop());
      else setState({ stream, status: 'ready' });
    };
    void start();
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((track) => track.stop());
      setState({ stream: null, status: 'off' });
    };
  }, [active, deviceId]);

  return active ? state : { stream: null, status: 'off' as const };
}

/** Cameras on this device (names appear once camera permission was given). */
export async function listCameras(): Promise<MediaDeviceInfo[]> {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter((device) => device.kind === 'videoinput');
  } catch {
    return [];
  }
}
