import { isRouteErrorResponse, Link, useRouteError } from 'react-router';
import { useT } from '@/i18n';
import styles from './RouteError.module.css';

export function RouteError() {
  const error = useRouteError();
  const t = useT();
  const notFound = isRouteErrorResponse(error) && error.status === 404;
  const detail = error instanceof Error ? error.message : isRouteErrorResponse(error) ? error.statusText : '';

  return (
    <main className={styles.page}>
      <h1>{notFound ? t('error.notFound') : t('error.title')}</h1>
      {!notFound && detail && <pre className={styles.detail}>{detail}</pre>}
      <div className={styles.actions}>
        <Link to="/">{t('error.backToLibrary')}</Link>
        <button type="button" onClick={() => location.reload()}>
          {t('action.reload')}
        </button>
      </div>
    </main>
  );
}
