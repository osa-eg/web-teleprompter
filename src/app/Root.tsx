import { useEffect } from 'react';
import { Outlet } from 'react-router';
import { useT } from '@/i18n';
import { onDatabaseBlocked } from '@/storage/db';
import { Toaster } from '@/ui/Toaster';
import { toast } from '@/ui/toast';
import { useDocumentDirection } from './useDocumentDirection';

/** Top-level layout shared by every route (including the full-screen prompter). */
export function Root() {
  useDocumentDirection();
  const t = useT();

  useEffect(
    () =>
      onDatabaseBlocked(() =>
        toast({
          message: t('toast.dbBlocked'),
          tone: 'error',
          duration: 0,
          action: { label: t('action.reload'), run: () => location.reload() },
        }),
      ),
    [t],
  );

  return (
    <>
      <Outlet />
      <Toaster />
    </>
  );
}
