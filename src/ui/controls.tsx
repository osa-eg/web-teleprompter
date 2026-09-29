import clsx from 'clsx';
import { useId, type ReactNode } from 'react';
import styles from './controls.module.css';

interface SliderProps {
  label: ReactNode;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  format?: (value: number) => string;
  hint?: ReactNode;
  disabled?: boolean;
}

export function Slider({ label, value, min, max, step = 1, onChange, format, hint, disabled }: SliderProps) {
  const id = useId();
  return (
    <div className={clsx(styles.field, disabled && styles.disabled)}>
      <div className={styles.row}>
        <label htmlFor={id} className={styles.label}>
          {label}
        </label>
        <output htmlFor={id} className={styles.value}>
          {format ? format(value) : value}
        </output>
      </div>
      <input
        id={id}
        type="range"
        className={styles.range}
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.currentTarget.value))}
      />
      {hint && <p className={styles.hint}>{hint}</p>}
    </div>
  );
}

interface SwitchProps {
  label: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
  hint?: ReactNode;
  disabled?: boolean;
}

export function Switch({ label, checked, onChange, hint, disabled }: SwitchProps) {
  const id = useId();
  return (
    <div className={clsx(styles.field, disabled && styles.disabled)}>
      <div className={styles.row}>
        <label htmlFor={id} className={styles.label}>
          {label}
        </label>
        <input
          id={id}
          type="checkbox"
          role="switch"
          className={styles.switch}
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.currentTarget.checked)}
        />
      </div>
      {hint && <p className={styles.hint}>{hint}</p>}
    </div>
  );
}

interface ChoiceProps<T extends string> {
  label: ReactNode;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
  hint?: ReactNode;
}

export function Choice<T extends string>({ label, value, options, onChange, hint }: ChoiceProps<T>) {
  const id = useId();
  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      <select
        id={id}
        className={styles.select}
        value={value}
        onChange={(e) => onChange(e.currentTarget.value as T)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {hint && <p className={styles.hint}>{hint}</p>}
    </div>
  );
}

interface ColorFieldProps {
  label: ReactNode;
  value: string;
  onChange: (value: string) => void;
}

export function ColorField({ label, value, onChange }: ColorFieldProps) {
  const id = useId();
  return (
    <div className={clsx(styles.field, styles.colorField)}>
      <input
        id={id}
        type="color"
        className={styles.color}
        value={value}
        onChange={(e) => onChange(e.currentTarget.value)}
      />
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
    </div>
  );
}

export function Section({
  title,
  children,
  actions,
}: {
  title: ReactNode;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <h3>{title}</h3>
        {actions}
      </div>
      <div className={styles.sectionBody}>{children}</div>
    </section>
  );
}
