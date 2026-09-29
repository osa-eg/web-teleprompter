import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { CameraSettings } from '@/stores/settingsSchema';
import styles from './CameraLayer.module.css';

interface CameraLayerProps {
  stream: MediaStream | null;
  layout: CameraSettings['layout'];
  mirror: boolean;
  label: string;
}

function Video({ stream, mirror }: { stream: MediaStream | null; mirror: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    video.srcObject = stream;
    if (stream) void video.play().catch(() => undefined);
  }, [stream]);
  // muted + playsInline: required for inline autoplay on iOS; the recording keeps its own audio.
  return (
    <video
      ref={ref}
      className={styles.video}
      data-mirror={mirror || undefined}
      data-testid="camera-video"
      muted
      playsInline
      autoPlay
    />
  );
}

/**
 * Camera preview: behind the text (dimmed, text gets a shadow) or as a small window the operator can
 * drag. The preview can be flipped like a mirror; recordings never are.
 */
export function CameraLayer({ stream, layout, mirror, label }: CameraLayerProps) {
  // Offset of the small window from its default corner, in px.
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const drag = useRef<{ id: number; x: number; y: number; start: { x: number; y: number } } | null>(null);

  if (layout === 'background') {
    return (
      <div
        className={styles.background}
        data-testid="camera-layer"
        data-layout="background"
        aria-label={label}
      >
        <Video stream={stream} mirror={mirror} />
      </div>
    );
  }

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, start: offset };
  };
  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== event.pointerId) return;
    setOffset({ x: d.start.x + event.clientX - d.x, y: d.start.y + event.clientY - d.y });
  };
  const onPointerUp = () => {
    drag.current = null;
  };

  return (
    <div
      className={styles.pip}
      style={{ translate: `${offset.x}px ${offset.y}px` }}
      data-testid="camera-layer"
      data-layout="pip"
      role="img"
      aria-label={label}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <Video stream={stream} mirror={mirror} />
    </div>
  );
}
