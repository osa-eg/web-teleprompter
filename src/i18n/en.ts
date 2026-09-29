/** A message with CLDR plural forms, selected with Intl.PluralRules on the `count` param. */
export interface PluralMessage {
  zero?: string;
  one?: string;
  two?: string;
  few?: string;
  many?: string;
  other: string;
}
export type Message = string | PluralMessage;

/** English is the source of truth for message keys; `ar.ts` must provide exactly the same keys. */
export const en = {
  'app.name': 'Web Teleprompter',
  'app.tagline': 'A professional teleprompter with first-class Arabic support',

  'nav.main': 'Main navigation',
  'nav.library': 'Library',
  'nav.settings': 'Settings',

  'ui.switchLanguage': 'العربية',
  'ui.switchLanguageLabel': 'Switch the interface to Arabic',
  'ui.language': 'Interface language',
  'ui.theme': 'Theme',
  'ui.theme.system': 'System',
  'ui.theme.dark': 'Dark',
  'ui.theme.light': 'Light',
  'ui.themeToggle': 'Theme: {theme}',
  'ui.digits': 'Numerals',
  'ui.digits.latn': 'Western (123)',
  'ui.digits.arab': 'Arabic-Indic (١٢٣)',

  'library.title': 'Your scripts',
  'library.new': 'New script',
  'library.search': 'Search scripts',
  'library.sort': 'Sort by',
  'library.sort.updated': 'Last edited',
  'library.sort.created': 'Date created',
  'library.sort.title': 'Title',
  'library.empty': 'No scripts yet. Create your first one!',
  'library.noResults': 'No scripts match “{query}”.',
  'library.loading': 'Loading your scripts…',
  'library.count': { one: '{count} script', other: '{count} scripts' },
  'library.words': { one: '{count} word', other: '{count} words' },
  'library.duration': '≈ {duration}',
  'library.durationHint': 'Estimated reading time at {wpm} words per minute',
  'library.edited': 'Edited {time}',
  'library.memoryOnly':
    'Your browser is blocking local storage, so scripts will be lost when this tab closes. Export them to keep a copy.',

  'script.untitled': 'Untitled script',
  'script.copyTitle': '{title} (copy)',

  'action.edit': 'Edit',
  'action.prompt': 'Prompt',
  'action.startPrompting': 'Start prompting',
  'action.duplicate': 'Duplicate',
  'action.delete': 'Delete',
  'action.undo': 'Undo',
  'action.back': 'Back',
  'action.close': 'Close',
  'action.reload': 'Reload',
  'action.reset': 'Reset',

  'toast.deleted': 'Deleted “{title}”',
  'toast.duplicated': 'Created a copy of “{title}”',
  'toast.dbBlocked': 'A newer version of the app is open in another tab. Reload this tab to continue.',

  'editor.title': 'Title',
  'editor.body': 'Script',
  'editor.bodyPlaceholder': 'Type or paste your script here…',
  'editor.saving': 'Saving…',
  'editor.saved': 'Saved',
  'editor.notFound': 'This script does not exist or was deleted.',
  'editor.direction': 'Text direction',

  'dir.auto': 'Automatic',
  'dir.rtl': 'Right to left',
  'dir.ltr': 'Left to right',

  'settings.title': 'Settings',
  'settings.interface': 'Interface',
  'settings.resetSection': 'Reset this section',

  'prompter.loading': 'Preparing the prompter…',

  'error.title': 'Something went wrong',
  'error.notFound': 'Page not found',
  'error.backToLibrary': 'Back to the library',
} satisfies Record<string, Message>;

export type MessageKey = keyof typeof en;
export type Messages = Record<MessageKey, Message>;
