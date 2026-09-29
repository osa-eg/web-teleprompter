import styles from './LoadingScreen.module.css';

export function LoadingScreen({ label }: { label?: string }) {
  return (
    <div className={styles.screen} role="status" aria-live="polite">
      <span className={styles.spinner} aria-hidden />
      {label && <span>{label}</span>}
    </div>
  );
}
