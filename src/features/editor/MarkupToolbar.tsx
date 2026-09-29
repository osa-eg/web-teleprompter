import {
  ArrowRightLeft,
  Bold,
  CircleHelp,
  CirclePause,
  Eye,
  EyeOff,
  Heading,
  Highlighter,
  Italic,
  MessageSquareText,
} from 'lucide-react';
import { useState, type RefObject } from 'react';
import { toggleLineMark } from '@/core/script/direction';
import { useT } from '@/i18n';
import { IconButton } from '@/ui/Button';
import { cycleHeading, insertToken, toggleWrap, transformLine } from './textareaCommands';
import styles from './MarkupToolbar.module.css';

interface MarkupToolbarProps {
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  previewOpen: boolean;
  onTogglePreview: () => void;
}

const SYNTAX: [string, Parameters<ReturnType<typeof useT>>[0]][] = [
  ['⏎⏎', 'syntax.paragraph'],
  ['# …', 'syntax.heading'],
  ['**…**', 'syntax.bold'],
  ['*…*', 'syntax.emphasis'],
  ['==…==', 'syntax.mark'],
  ['[[…]]', 'syntax.note'],
  ['[pause] [توقف]', 'syntax.pause'],
  ['[pause 3] [وقفة ٣]', 'syntax.pauseTimed'],
  ['⇄', 'syntax.direction'],
  ['\\* \\[', 'syntax.escape'],
];

export function MarkupToolbar({ textareaRef, previewOpen, onTogglePreview }: MarkupToolbarProps) {
  const t = useT();
  const [helpOpen, setHelpOpen] = useState(false);

  // Only ever called from event handlers, never during render.
  const act = (fn: (textarea: HTMLTextAreaElement) => void) => {
    const textarea = textareaRef.current;
    if (textarea) fn(textarea);
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.toolbar} role="toolbar" aria-label={t('editor.toolbar')}>
        <IconButton
          size="sm"
          label={t('editor.bold')}
          onClick={() => act((ta) => toggleWrap(ta, '**', '**', t('editor.placeholderText')))}
        >
          <Bold size={18} aria-hidden />
        </IconButton>
        <IconButton
          size="sm"
          label={t('editor.emphasis')}
          onClick={() => act((ta) => toggleWrap(ta, '*', '*', t('editor.placeholderText')))}
        >
          <Italic size={18} aria-hidden />
        </IconButton>
        <IconButton
          size="sm"
          label={t('editor.highlight')}
          onClick={() => act((ta) => toggleWrap(ta, '==', '==', t('editor.placeholderText')))}
        >
          <Highlighter size={18} aria-hidden />
        </IconButton>
        <span className={styles.separator} />
        <IconButton
          size="sm"
          label={t('editor.heading')}
          onClick={() => act((ta) => transformLine(ta, cycleHeading))}
        >
          <Heading size={18} aria-hidden />
        </IconButton>
        <IconButton
          size="sm"
          label={t('editor.pause')}
          onClick={() => act((ta) => insertToken(ta, t('editor.pauseToken')))}
        >
          <CirclePause size={18} aria-hidden />
        </IconButton>
        <IconButton
          size="sm"
          label={t('editor.note')}
          onClick={() => act((ta) => toggleWrap(ta, '[[', ']]', t('editor.placeholderNote')))}
        >
          <MessageSquareText size={18} aria-hidden />
        </IconButton>
        <IconButton
          size="sm"
          label={t('editor.lineDirection')}
          onClick={() => act((ta) => transformLine(ta, toggleLineMark))}
        >
          <ArrowRightLeft size={18} aria-hidden />
        </IconButton>
        <span className={styles.separator} />
        <IconButton
          size="sm"
          label={t('editor.syntax')}
          pressed={helpOpen}
          onClick={() => setHelpOpen((o) => !o)}
        >
          <CircleHelp size={18} aria-hidden />
        </IconButton>
        <span className={styles.spacer} />
        <IconButton
          size="sm"
          label={previewOpen ? t('editor.hidePreview') : t('editor.showPreview')}
          pressed={previewOpen}
          onClick={onTogglePreview}
        >
          {previewOpen ? <EyeOff size={18} aria-hidden /> : <Eye size={18} aria-hidden />}
        </IconButton>
      </div>

      {helpOpen && (
        <dl className={styles.syntax} data-testid="syntax-help">
          {SYNTAX.map(([code, key]) => (
            <div key={key} className={styles.syntaxRow}>
              <dt>
                <code dir="auto">{code}</code>
              </dt>
              <dd>{t(key)}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
