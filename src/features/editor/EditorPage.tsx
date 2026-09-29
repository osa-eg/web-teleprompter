import { ArrowLeft, Check, Download, LoaderCircle, Play, TriangleAlert, WandSparkles } from 'lucide-react';
import { useDeferredValue, useMemo, useState, type ClipboardEvent, type KeyboardEvent } from 'react';
import { useParams } from 'react-router';
import { LoadingScreen } from '@/app/LoadingScreen';
import { CLEANUP_TOOLS, convertPresentationForms, type CleanupTool } from '@/core/import/cleanup';
import { htmlHasFormatting, htmlToMarkup } from '@/core/import/htmlToMarkup';
import { spokenWords } from '@/core/script/ast';
import { docToPlainText } from '@/core/script/export';
import { findEditorMismatches, fixEditorMismatches } from '@/core/script/direction';
import { parseScript } from '@/core/script/parse';
import { estimateDurationMs } from '@/core/script/stats';
import { fontStackFor } from '@/features/fonts/fontSettings';
import { useScriptFonts } from '@/features/fonts/useScriptFonts';
import { useFormat, useT } from '@/i18n';
import { downloadText, safeFileName } from '@/lib/download';
import type { Script, TextDirSetting } from '@/storage/types';
import { useLibrary } from '@/stores/library';
import { useSettings } from '@/stores/settings';
import { Button, ButtonLink } from '@/ui/Button';
import { Select } from '@/ui/Field';
import { Menu } from '@/ui/Menu';
import { toast } from '@/ui/toast';
import { MarkupToolbar } from './MarkupToolbar';
import { PreviewPane } from './PreviewPane';
import { insertText, toggleWrap } from './textareaCommands';
import styles from './EditorPage.module.css';

export function EditorPage() {
  const t = useT();
  const { id = '' } = useParams();
  const status = useLibrary((s) => s.status);
  const script = useLibrary((s) => s.scripts.find((x) => x.id === id));

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
  return <Editor key={script.id} script={script} />;
}

function Editor({ script }: { script: Script }) {
  const t = useT();
  const fmt = useFormat();
  const saving = useLibrary((s) => Boolean(s.saving[script.id]));
  const update = useLibrary((s) => s.update);
  const appearance = useSettings((s) => s.settings.appearance);
  const behavior = useSettings((s) => s.settings.behavior);
  const uiLang = useSettings((s) => s.settings.ui.lang);
  const [textarea, setTextarea] = useState<HTMLTextAreaElement | null>(null);
  const [previewOpen, setPreviewOpen] = useState(() => window.matchMedia('(min-width: 1000px)').matches);

  // Parsing lags behind typing so large scripts stay responsive.
  const body = useDeferredValue(script.body);
  const doc = useMemo(
    () => parseScript(body, { direction: script.direction, fallbackDir: uiLang === 'ar' ? 'rtl' : 'ltr' }),
    [body, script.direction, uiLang],
  );
  const words = spokenWords(doc, behavior.headingsSpoken);
  useScriptFonts(appearance, body);
  const mismatches = useMemo(
    () => (script.direction === 'auto' ? findEditorMismatches(body).length : 0),
    [body, script.direction],
  );

  const replaceAll = (next: string) => {
    if (!textarea) return false;
    if (next === textarea.value) return false;
    textarea.setSelectionRange(0, textarea.value.length);
    insertText(textarea, next);
    return true;
  };

  const applyTool = (tool: CleanupTool) => {
    if (!textarea) return;
    const changed = replaceAll(CLEANUP_TOOLS[tool](textarea.value));
    toast({
      message: changed ? t('tools.applied') : t('tools.noChange'),
      tone: changed ? 'success' : 'info',
    });
  };

  const exportAs = (format: 'txt' | 'md' | 'plain') => {
    const name = safeFileName(script.title || t('script.untitled'));
    if (format === 'plain') downloadText(`${name}.txt`, docToPlainText(doc));
    else if (format === 'md') downloadText(`${name}.md`, script.body, 'text/markdown;charset=utf-8');
    else downloadText(`${name}.txt`, script.body);
  };

  // Rich text keeps its headings and bold/italic; presentation-form glyphs (common when copying from
  // PDF files) are turned back into ordinary Arabic letters.
  const onPaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    const html = event.clipboardData.getData('text/html');
    const plain = event.clipboardData.getData('text/plain');
    const markup = html && htmlHasFormatting(html) ? htmlToMarkup(html) : null;
    const converted = convertPresentationForms(markup ?? plain);
    if (markup === null && converted === plain) return;
    event.preventDefault();
    insertText(event.currentTarget, converted);
  };

  const fixDirections = () => {
    if (!textarea) return;
    textarea.setSelectionRange(0, textarea.value.length);
    insertText(textarea, fixEditorMismatches(textarea.value));
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey) return;
    // Match physical keys so the shortcuts also work on Arabic keyboard layouts.
    if (event.code === 'KeyB') {
      event.preventDefault();
      toggleWrap(event.currentTarget, '**', '**', t('editor.placeholderText'));
    } else if (event.code === 'KeyI') {
      event.preventDefault();
      toggleWrap(event.currentTarget, '*', '*', t('editor.placeholderText'));
    }
  };

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
        <ButtonLink to={`/s/${script.id}/prompt`} variant="primary" icon={<Play size={18} aria-hidden />}>
          {t('action.startPrompting')}
        </ButtonLink>
      </div>

      <MarkupToolbar
        textarea={textarea}
        previewOpen={previewOpen}
        onTogglePreview={() => setPreviewOpen((open) => !open)}
        extra={
          <>
            <Menu
              label={t('editor.tools')}
              icon={<WandSparkles size={18} aria-hidden />}
              items={(Object.keys(CLEANUP_TOOLS) as CleanupTool[]).map((tool) => ({
                label: t(`tools.${tool}`),
                onSelect: () => applyTool(tool),
              }))}
            />
            <Menu
              label={t('action.export')}
              icon={<Download size={18} aria-hidden />}
              items={[
                { label: t('export.txt'), onSelect: () => exportAs('txt') },
                { label: t('export.md'), onSelect: () => exportAs('md') },
                { label: t('export.plain'), onSelect: () => exportAs('plain') },
              ]}
            />
          </>
        }
      />

      <div className={styles.split} data-preview={previewOpen || undefined}>
        <textarea
          ref={setTextarea}
          className={styles.body}
          aria-label={t('editor.body')}
          placeholder={t('editor.bodyPlaceholder')}
          defaultValue={script.body}
          dir={script.direction === 'auto' ? undefined : script.direction}
          data-dir-mode={script.direction}
          spellCheck
          style={{ fontFamily: fontStackFor(appearance) }}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
          onChange={(e) => update(script.id, { body: e.currentTarget.value })}
        />
        {previewOpen && <PreviewPane doc={doc} className={styles.preview} />}
      </div>

      {mismatches > 0 && (
        <div className={styles.notice} role="status">
          <TriangleAlert size={18} aria-hidden />
          <span>{t('editor.mismatch', { count: mismatches })}</span>
          <Button size="sm" onClick={fixDirections}>
            {t('editor.fixMismatch')}
          </Button>
        </div>
      )}

      <p className={styles.stats} data-testid="editor-stats">
        <span>{t('library.words', { count: words })}</span>
        <span aria-hidden>·</span>
        <span>{t('editor.chars', { count: doc.stats.chars })}</span>
        <span aria-hidden>·</span>
        <span title={t('library.durationHint', { wpm: behavior.wpm })}>
          {t('library.duration', { duration: fmt.duration(estimateDurationMs(words, behavior.wpm)) })}
        </span>
        <span aria-hidden>·</span>
        <span>{t('editor.sections', { count: doc.markers.length })}</span>
        <span aria-hidden>·</span>
        <span>{t('editor.cues', { count: doc.cues.length })}</span>
      </p>
    </div>
  );
}
