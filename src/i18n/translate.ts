import { ar } from './ar';
import { en, type Message, type MessageKey, type Messages, type PluralMessage } from './en';

export type UiLang = 'ar' | 'en';
export type UiDigits = 'latn' | 'arab';
export type TParams = Record<string, string | number>;
export type Translate = (key: MessageKey, params?: TParams) => string;

const catalogs: Record<UiLang, Messages> = { en, ar };

/**
 * BCP 47 locale with an explicit numbering system: CLDR's default digits differ between Arabic
 * regions, so the user chooses Western (latn) or Arabic-Indic (arab) digits for Arabic.
 */
export function localeFor(lang: UiLang, digits: UiDigits = 'latn'): string {
  return lang === 'ar' ? `ar-u-nu-${digits}` : 'en-u-nu-latn';
}

function pickPlural(msg: PluralMessage, count: number, rules: Intl.PluralRules): string {
  if (count === 0 && msg.zero !== undefined) return msg.zero;
  const category = rules.select(count) as keyof PluralMessage;
  return msg[category] ?? msg.other;
}

export function createTranslator(lang: UiLang, digits: UiDigits = 'latn'): Translate {
  const locale = localeFor(lang, digits);
  const rules = new Intl.PluralRules(locale);
  const numbers = new Intl.NumberFormat(locale);
  const catalog = catalogs[lang];

  return (key, params) => {
    const msg: Message = catalog[key] ?? en[key];
    const count = Number(params?.count ?? 0);
    const text = typeof msg === 'string' ? msg : pickPlural(msg, count, rules);
    if (!params) return text;
    return text.replace(/\{(\w+)\}/g, (match, name: string) => {
      const value = params[name];
      if (value === undefined) return match;
      return typeof value === 'number' ? numbers.format(value) : value;
    });
  };
}
