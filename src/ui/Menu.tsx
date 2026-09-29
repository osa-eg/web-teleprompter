import clsx from 'clsx';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import styles from './Menu.module.css';

export interface MenuItem {
  label: string;
  onSelect: () => void;
  disabled?: boolean;
}

interface MenuProps {
  label: string;
  icon: ReactNode;
  items: MenuItem[];
  /** Show the label next to the icon (otherwise icon-only with a tooltip). */
  showLabel?: boolean;
  size?: 'sm' | 'md';
}

/** Small dropdown menu (closes on outside click, Escape or selection). */
export function Menu({ label, icon, items, showLabel = false, size = 'sm' }: MenuProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className={styles.wrap}>
      <button
        type="button"
        className={clsx(styles.trigger, styles[size], showLabel && styles.withLabel)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={id}
        aria-label={showLabel ? undefined : label}
        title={label}
        onClick={() => setOpen((value) => !value)}
      >
        {icon}
        {showLabel && <span>{label}</span>}
      </button>
      {open && (
        <ul id={id} role="menu" className={styles.menu}>
          {items.map((item) => (
            <li key={item.label} role="none">
              <button
                type="button"
                role="menuitem"
                disabled={item.disabled}
                onClick={() => {
                  setOpen(false);
                  item.onSelect();
                }}
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
