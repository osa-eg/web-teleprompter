import clsx from 'clsx';
import { useEffect, useRef, useState } from 'react';
import type { FontRef } from '@/stores/settingsSchema';
import { ensureFont } from './loader';
import { enqueuePreview } from './previewQueue';
import { quoteFamily } from './stack';
import styles from './FontPicker.module.css';

interface FontPreviewProps {
  fontRef: FontRef;
  family: string;
  text: string;
  weight?: number;
  className?: string;
}

/** Sample text in a font; the font only loads once the preview scrolls into view. */
export function FontPreview({ fontRef, family, text, weight = 400, className }: FontPreviewProps) {
  const elementRef = useRef<HTMLSpanElement>(null);
  const [loaded, setLoaded] = useState(fontRef.kind === 'system' || fontRef.kind === 'local');
  const refKey = JSON.stringify(fontRef);

  useEffect(() => {
    const element = elementRef.current;
    if (!element || fontRef.kind === 'system' || fontRef.kind === 'local') return;
    let cancelled = false;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        void enqueuePreview(() => ensureFont(fontRef, [weight], text)).finally(() => {
          if (!cancelled) setLoaded(true);
        });
      },
      { rootMargin: '200px' },
    );
    observer.observe(element);
    return () => {
      cancelled = true;
      observer.disconnect();
    };
    // refKey stands in for fontRef.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refKey, text, weight]);

  return (
    <span
      ref={elementRef}
      className={clsx(styles.preview, loaded && styles.previewLoaded, className)}
      style={{ fontFamily: `${quoteFamily(family)}, sans-serif`, fontWeight: weight }}
      dir="auto"
    >
      {text}
    </span>
  );
}
