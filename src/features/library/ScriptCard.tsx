import { Copy, Download, Pencil, Play, Trash2 } from 'lucide-react';
import { memo, useMemo } from 'react';
import { Link } from 'react-router';
import { countWords, estimateDurationMs } from '@/core/script/stats';
import { useFormat, useT } from '@/i18n';
import type { Script } from '@/storage/types';
import { useLibrary } from '@/stores/library';
import { downloadText, safeFileName } from '@/lib/download';
import { useSettings } from '@/stores/settings';
import { ButtonLink, IconButton } from '@/ui/Button';
import { toast } from '@/ui/toast';
import styles from './ScriptCard.module.css';

/** First meaningful line of the script, with markup removed. */
function snippetOf(body: string): string {
  for (const raw of body.split('\n')) {
    const line = raw
      .replace(/\[\[.*?\]\]/g, '')
      .replace(/\[[^\]]*\]/g, '')
      .replace(/^#{1,3}\s+/, '')
      .replace(/\*\*|==|[*_]/g, '')
      .trim();
    if (line) return line.length > 180 ? `${line.slice(0, 180)}…` : line;
  }
  return '';
}

export const ScriptCard = memo(function ScriptCard({ script }: { script: Script }) {
  const t = useT();
  const fmt = useFormat();
  const wpm = useSettings((s) => s.settings.behavior.wpm);
  const { remove, restore, duplicate } = useLibrary.getState();

  const words = useMemo(() => countWords(script.body), [script.body]);
  const snippet = useMemo(() => snippetOf(script.body), [script.body]);
  const title = script.title.trim() || t('script.untitled');

  const onDelete = async () => {
    const removed = await remove(script.id);
    if (!removed) return;
    toast({
      message: t('toast.deleted', { title }),
      action: { label: t('action.undo'), run: () => void restore(removed) },
    });
  };

  const onDuplicate = async () => {
    const copy = await duplicate(script.id, t('script.copyTitle', { title }));
    if (copy) toast({ message: t('toast.duplicated', { title }), tone: 'success' });
  };

  return (
    <article className={styles.card} data-testid="script-card">
      <h2 className={styles.title} dir="auto">
        <Link to={`/s/${script.id}/edit`}>{title}</Link>
      </h2>
      {snippet && (
        <p className={styles.snippet} dir="auto">
          {snippet}
        </p>
      )}
      <p className={styles.meta}>
        <span>{t('library.words', { count: words })}</span>
        <span aria-hidden>·</span>
        <span title={t('library.durationHint', { wpm })}>
          {t('library.duration', { duration: fmt.duration(estimateDurationMs(words, wpm)) })}
        </span>
        <span aria-hidden>·</span>
        <time dateTime={new Date(script.updatedAt).toISOString()} title={fmt.dateTime(script.updatedAt)}>
          {t('library.edited', { time: fmt.relative(script.updatedAt) })}
        </time>
      </p>
      <div className={styles.actions}>
        <ButtonLink
          to={`/s/${script.id}/prompt`}
          variant="primary"
          size="sm"
          icon={<Play size={16} aria-hidden />}
        >
          {t('action.prompt')}
        </ButtonLink>
        <span className={styles.spacer} />
        <ButtonLink
          to={`/s/${script.id}/edit`}
          variant="ghost"
          size="sm"
          icon={<Pencil size={16} aria-hidden />}
        >
          {t('action.edit')}
        </ButtonLink>
        <IconButton
          label={t('action.export')}
          size="sm"
          onClick={() => downloadText(`${safeFileName(title)}.txt`, script.body)}
        >
          <Download size={16} aria-hidden />
        </IconButton>
        <IconButton label={t('action.duplicate')} size="sm" onClick={() => void onDuplicate()}>
          <Copy size={16} aria-hidden />
        </IconButton>
        <IconButton label={t('action.delete')} size="sm" onClick={() => void onDelete()}>
          <Trash2 size={16} aria-hidden />
        </IconButton>
      </div>
    </article>
  );
});
