import clsx from 'clsx';
import { useId, type ReactNode, type SelectHTMLAttributes } from 'react';
import styles from './Field.module.css';

interface FieldProps {
  label: ReactNode;
  hint?: ReactNode;
  className?: string;
  children: (id: string) => ReactNode;
}

/** Label + control + optional hint, laid out consistently across settings panels. */
export function Field({ label, hint, className, children }: FieldProps) {
  const id = useId();
  return (
    <div className={clsx(styles.field, className)}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      {children(id)}
      {hint && <p className={styles.hint}>{hint}</p>}
    </div>
  );
}

export interface SelectOption<T extends string> {
  value: T;
  label: string;
}

interface SelectProps<T extends string> extends Omit<
  SelectHTMLAttributes<HTMLSelectElement>,
  'onChange' | 'value'
> {
  value: T;
  options: readonly SelectOption<T>[];
  onChange: (value: T) => void;
}

export function Select<T extends string>({ value, options, onChange, className, ...rest }: SelectProps<T>) {
  return (
    <select
      className={clsx(styles.select, className)}
      value={value}
      onChange={(e) => onChange(e.currentTarget.value as T)}
      {...rest}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
