import { FilePlus2, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { LoadingScreen } from '@/app/LoadingScreen';
import { normalizeArabic } from '@/core/script/arabic';
import { useT } from '@/i18n';
import type { Script } from '@/storage/types';
import { useLibrary } from '@/stores/library';
import { Button } from '@/ui/Button';
import { Select } from '@/ui/Field';
import { ScriptCard } from './ScriptCard';
import styles from './LibraryPage.module.css';

type SortKey = 'updated' | 'created' | 'title';

function sortScripts(scripts: Script[], key: SortKey, locale: string): Script[] {
  const copy = [...scripts];
  if (key === 'title') {
    const collator = new Intl.Collator(locale, { sensitivity: 'base', numeric: true });
    return copy.sort((a, b) => collator.compare(a.title, b.title));
  }
  const field = key === 'created' ? 'createdAt' : 'updatedAt';
  return copy.sort((a, b) => b[field] - a[field]);
}

export function LibraryPage() {
  const t = useT();
  const navigate = useNavigate();
  const status = useLibrary((s) => s.status);
  const scripts = useLibrary((s) => s.scripts);
  const create = useLibrary((s) => s.create);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('updated');

  const visible = useMemo(() => {
    const needle = normalizeArabic(query.trim());
    const filtered = needle
      ? scripts.filter((s) => normalizeArabic(`${s.title}\n${s.body}`).includes(needle))
      : scripts;
    return sortScripts(filtered, sort, document.documentElement.lang || 'en');
  }, [scripts, query, sort]);

  const onNew = async () => {
    const script = await create();
    navigate(`/s/${script.id}/edit`);
  };

  return (
    <div className={styles.page}>
      <div className={styles.toolbar}>
        <div className={styles.heading}>
          <h1>{t('library.title')}</h1>
          {status === 'ready' && (
            <p className={styles.count}>{t('library.count', { count: scripts.length })}</p>
          )}
        </div>
        <div className={styles.controls}>
          <label className={styles.search}>
            <Search size={18} aria-hidden />
            <span className="visually-hidden">{t('library.search')}</span>
            <input
              type="search"
              value={query}
              placeholder={t('library.search')}
              onChange={(e) => setQuery(e.currentTarget.value)}
              dir="auto"
            />
          </label>
          <Select
            aria-label={t('library.sort')}
            value={sort}
            onChange={setSort}
            options={[
              { value: 'updated', label: t('library.sort.updated') },
              { value: 'created', label: t('library.sort.created') },
              { value: 'title', label: t('library.sort.title') },
            ]}
          />
          <Button variant="primary" icon={<FilePlus2 size={18} aria-hidden />} onClick={() => void onNew()}>
            {t('library.new')}
          </Button>
        </div>
      </div>

      {status !== 'ready' ? (
        <LoadingScreen label={t('library.loading')} />
      ) : visible.length === 0 ? (
        <p className={styles.empty}>{query ? t('library.noResults', { query }) : t('library.empty')}</p>
      ) : (
        <ul className={styles.grid} data-testid="script-list">
          {visible.map((script) => (
            <li key={script.id}>
              <ScriptCard script={script} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
