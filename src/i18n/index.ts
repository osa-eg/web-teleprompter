import { useMemo } from 'react';
import { useSettings } from '@/stores/settings';
import { createFormatters, type Formatters } from './format';
import { createTranslator, type Translate } from './translate';

export type { MessageKey } from './en';
export type { Translate, UiLang, UiDigits } from './translate';
export type { Formatters } from './format';

export function useT(): Translate {
  const lang = useSettings((s) => s.settings.ui.lang);
  const digits = useSettings((s) => s.settings.ui.digits);
  return useMemo(() => createTranslator(lang, digits), [lang, digits]);
}

export function useFormat(): Formatters {
  const lang = useSettings((s) => s.settings.ui.lang);
  const digits = useSettings((s) => s.settings.ui.digits);
  return useMemo(() => createFormatters(lang, digits), [lang, digits]);
}
