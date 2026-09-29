import clsx from 'clsx';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router';
import styles from './Button.module.css';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface CommonProps {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
  className?: string;
  children?: ReactNode;
}

export function Button({
  variant = 'secondary',
  size = 'md',
  icon,
  className,
  children,
  type = 'button',
  ...rest
}: CommonProps & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type={type} className={clsx(styles.button, styles[variant], styles[size], className)} {...rest}>
      {icon}
      {children}
    </button>
  );
}

export function ButtonLink({
  variant = 'secondary',
  size = 'md',
  icon,
  className,
  children,
  ...rest
}: CommonProps & LinkProps) {
  return (
    <Link className={clsx(styles.button, styles[variant], styles[size], className)} {...rest}>
      {icon}
      {children}
    </Link>
  );
}

interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  /** Accessible name; also shown as a tooltip. */
  label: string;
  children: ReactNode;
  variant?: Variant;
  size?: Size;
  pressed?: boolean;
}

export function IconButton({
  label,
  children,
  variant = 'ghost',
  size = 'md',
  pressed,
  className,
  type = 'button',
  ...rest
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      className={clsx(styles.button, styles.icon, styles[variant], styles[size], className)}
      {...rest}
    >
      {children}
    </button>
  );
}
