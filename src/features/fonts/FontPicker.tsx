import clsx from 'clsx';
import { Check, HardDrive, Search, Trash2, Upload, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { normalizeArabic } from '@/core/script/arabic';
import { useT } from '@/i18n';
import { useFonts } from '@/stores/fonts';
import { useSettings, type FontRef } from '@/stores/settings';
import { Button, IconButton } from '@/ui/Button';
import { toast } from '@/ui/toast';
import { ARABIC_CATEGORIES, CATALOG, isArabicFont, isLatinOnly, type CatalogFont } from './catalog';
import { FONT_ACCEPT } from './customFonts';
import { fontRefEquals } from './fontSettings';
import { FontPreview } from './FontPreview';
import { localFontsSupported, queryLocalFamilies } from './localFonts';
import { customFamily } from './stack';
import { isFontInstalled, SYSTEM_FONTS } from './systemFonts';
import styles from './FontPicker.module.css';

export type FontPickerMode = 'primary' | 'latin';
type ScriptFilter = 'all' | 'arabic' | 'latin';

interface FontPickerProps {
  mode: FontPickerMode;
  value: FontRef | null;
  onSelect: (ref: FontRef | null) => void;
  onClose: () => void;
}

interface OptionProps {
  fontRef: FontRef;
  family: string;
  name: string;
  sample: string;
  selected: boolean;
  badge?: ReactNode;
  onSelect: (ref: FontRef) => void;
  actions?: ReactNode;
}

function FontOption({ fontRef, family, name, sample, selected, badge, onSelect, actions }: OptionProps) {
  return (
    <li className={clsx(styles.option, selected && styles.selected)}>
      <button
        type="button"
        className={styles.optionButton}
        aria-pressed={selected}
        data-font={family}
        onClick={() => onSelect(fontRef)}
      >
        <span className={styles.optionHead}>
          <span className={styles.optionName} dir="auto">
            {name}
          </span>
          {badge}
          {selected && <Check size={16} aria-hidden className={styles.check} />}
        </span>
        <FontPreview fontRef={fontRef} family={family} text={sample} />
      </button>
      {actions && <span className={styles.optionActions}>{actions}</span>}
    </li>
  );
}

function Group({ title, count, children }: { title: string; count?: number; children: ReactNode }) {
  return (
    <section className={styles.group}>
      <h3 className={styles.groupTitle}>
        {title}
        {count !== undefined && <span className={styles.groupCount}>{count}</span>}
      </h3>
      <ul className={styles.grid}>{children}</ul>
    </section>
  );
}

/** Font browser: bundled Arabic/Latin library, uploaded fonts and fonts installed on the device. */
export function FontPicker({ mode, value, onSelect, onClose }: FontPickerProps) {
  const t = useT();
  const lang = useSettings((s) => s.settings.ui.lang);
  const custom = useFonts((s) => s.custom);
  const { upload, remove } = useFonts.getState();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<ScriptFilter>(mode === 'latin' ? 'latin' : 'all');
  const [manual, setManual] = useState('');
  const [localFamilies, setLocalFamilies] = useState<string[] | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    void useFonts.getState().init();
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  const needle = normalizeArabic(query.trim());
  const matchesText = (text: string) => !needle || normalizeArabic(text).includes(needle);
  const matchesCatalog = (font: CatalogFont) =>
    matchesText(`${font.names.ar} ${font.names.en}`) &&
    (filter === 'all' || (filter === 'arabic' ? isArabicFont(font) : isLatinOnly(font))) &&
    (mode === 'primary' || isLatinOnly(font));

  const catalog = CATALOG.filter(matchesCatalog);
  const deviceFonts = useMemo(
    () => SYSTEM_FONTS.filter((font) => (mode === 'primary' || !font.arabic) && isFontInstalled(font.family)),
    [mode],
  );
  const customFonts = custom.filter(
    (font) => matchesText(font.name) && (mode === 'primary' || !font.hasArabic),
  );

  const select = (ref: FontRef | null) => {
    onSelect(ref);
    onClose();
  };

  const sampleFor = (arabic: boolean) =>
    arabic ? `${t('fonts.sampleArabic')} · Aa` : t('fonts.sampleLatin');

  const onUpload = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      const { added, errors } = await upload([...files]);
      for (const error of errors)
        toast({ message: t(`fonts.error.${error.reason}`, { file: error.file }), tone: 'error' });
      if (added.length) toast({ message: t('fonts.uploaded', { count: added.length }), tone: 'success' });
      const [first] = added;
      if (added.length === 1 && first) select({ kind: 'custom', id: first.id });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const onShowLocal = async () => {
    try {
      setLocalFamilies(await queryLocalFamilies());
    } catch {
      toast({ message: t('fonts.localDenied'), tone: 'error' });
    }
  };

  const catalogOption = (font: CatalogFont) => (
    <FontOption
      key={font.id}
      fontRef={{ kind: 'catalog', id: font.id }}
      family={font.family}
      name={font.names[lang]}
      sample={sampleFor(isArabicFont(font))}
      selected={fontRefEquals(value, { kind: 'catalog', id: font.id })}
      badge={font.variable ? <span className={styles.badge}>{t('fonts.variable')}</span> : undefined}
      onSelect={select}
    />
  );

  const recommended = mode === 'primary' && filter !== 'latin' ? catalog.filter((f) => f.recommended) : [];
  const shownIds = new Set(recommended.map((f) => f.id));

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-labelledby="tp-font-picker-title"
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      data-testid="font-picker"
    >
      <header className={styles.header}>
        <h2 id="tp-font-picker-title">{mode === 'latin' ? t('fonts.latinTitle') : t('fonts.title')}</h2>
        <IconButton label={t('action.close')} onClick={onClose}>
          <X size={20} aria-hidden />
        </IconButton>
      </header>

      <div className={styles.controls}>
        <label className={styles.search}>
          <Search size={18} aria-hidden />
          <span className="visually-hidden">{t('fonts.search')}</span>
          <input
            type="search"
            value={query}
            placeholder={t('fonts.search')}
            dir="auto"
            onChange={(e) => setQuery(e.currentTarget.value)}
          />
        </label>
        {mode === 'primary' && (
          <div className={styles.filters} role="group" aria-label={t('fonts.search')}>
            {(['all', 'arabic', 'latin'] as const).map((option) => (
              <button
                key={option}
                type="button"
                className={styles.chip}
                aria-pressed={filter === option}
                onClick={() => setFilter(option)}
              >
                {t(`fonts.filter.${option}`)}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className={styles.body}>
        {mode === 'latin' && <p className={styles.hint}>{t('fonts.latinHint')}</p>}
        {mode === 'latin' && (
          <ul className={styles.grid}>
            <li className={clsx(styles.option, value === null && styles.selected)}>
              <button
                type="button"
                className={styles.optionButton}
                aria-pressed={value === null}
                onClick={() => select(null)}
              >
                <span className={styles.optionHead}>
                  <span className={styles.optionName}>{t('fonts.none')}</span>
                  {value === null && <Check size={16} aria-hidden className={styles.check} />}
                </span>
              </button>
            </li>
          </ul>
        )}

        {recommended.length > 0 && (
          <Group title={t('fonts.recommended')} count={recommended.length}>
            {recommended.map(catalogOption)}
          </Group>
        )}

        {mode === 'primary' &&
          ARABIC_CATEGORIES.map((category) => {
            const fonts = catalog.filter(
              (f) => isArabicFont(f) && f.category === category && !shownIds.has(f.id),
            );
            if (!fonts.length) return null;
            return (
              <Group key={category} title={t(`fonts.cat.${category}`)} count={fonts.length}>
                {fonts.map(catalogOption)}
              </Group>
            );
          })}

        {catalog.some(isLatinOnly) && (
          <Group title={t('fonts.cat.latin')} count={catalog.filter(isLatinOnly).length}>
            {catalog.filter(isLatinOnly).map(catalogOption)}
          </Group>
        )}

        {catalog.length === 0 && customFonts.length === 0 && (
          <p className={styles.empty}>{t('fonts.empty')}</p>
        )}

        <section className={styles.group}>
          <div className={styles.groupHeader}>
            <h3 className={styles.groupTitle}>{t('fonts.mine')}</h3>
            <Button
              size="sm"
              icon={<Upload size={16} aria-hidden />}
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
            >
              {t('fonts.upload')}
            </Button>
            <input
              ref={fileRef}
              type="file"
              multiple
              accept={FONT_ACCEPT}
              hidden
              data-testid="font-upload"
              onChange={(e) => void onUpload(e.currentTarget.files)}
            />
          </div>
          <p className={styles.hint}>{t('fonts.uploadHint')}</p>
          {customFonts.length > 0 && (
            <ul className={styles.grid}>
              {customFonts.map((font) => (
                <FontOption
                  key={font.id}
                  fontRef={{ kind: 'custom', id: font.id }}
                  family={customFamily(font.id)}
                  name={font.name}
                  sample={sampleFor(font.hasArabic)}
                  selected={fontRefEquals(value, { kind: 'custom', id: font.id })}
                  badge={
                    !font.hasArabic ? <span className={styles.badge}>{t('fonts.noArabic')}</span> : undefined
                  }
                  onSelect={select}
                  actions={
                    <IconButton
                      size="sm"
                      label={t('fonts.delete')}
                      onClick={() => {
                        void remove(font.id);
                        toast({ message: t('fonts.deleted', { name: font.name }) });
                      }}
                    >
                      <Trash2 size={16} aria-hidden />
                    </IconButton>
                  }
                />
              ))}
            </ul>
          )}
        </section>

        <section className={styles.group}>
          <h3 className={styles.groupTitle}>{t('fonts.device')}</h3>
          <p className={styles.hint}>{t('fonts.deviceHint')}</p>
          <ul className={styles.grid}>
            {deviceFonts
              .filter((font) => matchesText(font.family))
              .map((font) => (
                <FontOption
                  key={font.family}
                  fontRef={{ kind: 'system', family: font.family }}
                  family={font.family}
                  name={font.family}
                  sample={sampleFor(font.arabic)}
                  selected={fontRefEquals(value, { kind: 'system', family: font.family })}
                  onSelect={select}
                />
              ))}
            {localFamilies
              ?.filter((family) => matchesText(family))
              .map((family) => (
                <FontOption
                  key={`local:${family}`}
                  fontRef={{ kind: 'local', family }}
                  family={family}
                  name={family}
                  sample={sampleFor(mode === 'primary')}
                  selected={fontRefEquals(value, { kind: 'local', family })}
                  onSelect={select}
                />
              ))}
          </ul>
          <div className={styles.deviceActions}>
            {localFontsSupported() && localFamilies === null && (
              <Button size="sm" icon={<HardDrive size={16} aria-hidden />} onClick={() => void onShowLocal()}>
                {t('fonts.showLocal')}
              </Button>
            )}
            <form
              className={styles.manual}
              onSubmit={(event) => {
                event.preventDefault();
                const family = manual.trim();
                if (family) select({ kind: 'system', family });
              }}
            >
              <input
                value={manual}
                placeholder={t('fonts.manual')}
                aria-label={t('fonts.manual')}
                dir="auto"
                onChange={(e) => setManual(e.currentTarget.value)}
              />
              <Button size="sm" type="submit" disabled={!manual.trim()}>
                {t('fonts.use')}
              </Button>
              {manual.trim() && !isFontInstalled(manual.trim()) && (
                <span className={styles.warning}>{t('fonts.notInstalled')}</span>
              )}
            </form>
          </div>
        </section>
      </div>
    </dialog>
  );
}
