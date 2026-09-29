import { ArrowLeft, Check, LoaderCircle, Play } from 'lucide-react';
import { useParams } from 'react-router';
import { LoadingScreen } from '@/app/LoadingScreen';
import { useT } from '@/i18n';
import type { TextDirSetting } from '@/storage/types';
import { useLibrary } from '@/stores/library';
import { ButtonLink } from '@/ui/Button';
import { Select } from '@/ui/Field';
import styles from './EditorPage.module.css';

export function EditorPage() {
  const t = useT();
  const { id = '' } = useParams();
  const status = useLibrary((s) => s.status);
  const script = useLibrary((s) => s.scripts.find((x) => x.id === id));
  const saving = useLibrary((s) => Boolean(s.saving[id]));
  const update = useLibrary((s) => s.update);

  if (status !== 'ready') return <LoadingScreen label={t('library.loading')} />;
  if (!script) {
    return (
      <div className={styles.missing}>
        <p>{t('editor.notFound')}</p>
        <ButtonLink to="/" variant="secondary">
          {t('error.backToLibrary')}
        </ButtonLink>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.bar}>
        <ButtonLink
          to="/"
          variant="ghost"
          size="sm"
          icon={<ArrowLeft size={18} aria-hidden className="flip-rtl" />}
        >
          {t('action.back')}
        </ButtonLink>
        <input
          className={styles.title}
          aria-label={t('editor.title')}
          placeholder={t('script.untitled')}
          value={script.title}
          dir="auto"
          onChange={(e) => update(script.id, { title: e.currentTarget.value })}
        />
        <Select<TextDirSetting>
          aria-label={t('editor.direction')}
          title={t('editor.direction')}
          value={script.direction}
          onChange={(direction) => update(script.id, { direction })}
          options={[
            { value: 'auto', label: t('dir.auto') },
            { value: 'rtl', label: t('dir.rtl') },
            { value: 'ltr', label: t('dir.ltr') },
          ]}
        />
        <span className={styles.status} aria-live="polite" data-state={saving ? 'saving' : 'saved'}>
          {saving ? (
            <LoaderCircle size={16} aria-hidden className={styles.spin} />
          ) : (
            <Check size={16} aria-hidden />
          )}
          <span>{saving ? t('editor.saving') : t('editor.saved')}</span>
        </span>
        <ButtonLink
          to={`/s/${script.id}/prompt`}
          variant="primary"
          icon={<Play size={18} aria-hidden className="flip-rtl" />}
        >
          {t('action.startPrompting')}
        </ButtonLink>
      </div>

      <textarea
        key={script.id}
        className={styles.body}
        aria-label={t('editor.body')}
        placeholder={t('editor.bodyPlaceholder')}
        defaultValue={script.body}
        dir={script.direction === 'auto' ? 'auto' : script.direction}
        spellCheck
        onChange={(e) => update(script.id, { body: e.currentTarget.value })}
      />
    </div>
  );
}
