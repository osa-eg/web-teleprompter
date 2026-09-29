import { LoadingScreen } from '@/app/LoadingScreen';
import { useT } from '@/i18n';

export function PrompterPage() {
  const t = useT();
  return <LoadingScreen label={t('prompter.loading')} />;
}
