import { useEffect } from 'react';
import { useT } from '@/i18n';
import { toast, useToasts } from '@/ui/toast';
import { usePwa } from './pwa';

/**
 * Offers a waiting app update. Rendered only on the library/editor/settings pages, never while a
 * script is being prompted.
 */
export function UpdateToast() {
  const t = useT();
  const needRefresh = usePwa((s) => s.needRefresh);
  const offlineReady = usePwa((s) => s.offlineReady);

  useEffect(() => {
    if (!needRefresh) return;
    const id = toast({
      message: t('pwa.update'),
      duration: 0,
      action: { label: t('pwa.reload'), run: () => void usePwa.getState().update?.() },
    });
    return () => useToasts.getState().dismiss(id);
  }, [needRefresh, t]);

  useEffect(() => {
    if (!offlineReady) return;
    toast({ message: t('pwa.offlineReady'), tone: 'success' });
    usePwa.setState({ offlineReady: false });
  }, [offlineReady, t]);

  return null;
}
