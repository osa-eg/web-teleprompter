import { localeFor, type UiDigits, type UiLang } from './translate';

export interface Formatters {
  locale: string;
  number(value: number, options?: Intl.NumberFormatOptions): string;
  /** Clock-style duration: `m:ss` or `h:mm:ss`. */
  duration(ms: number): string;
  relative(timestamp: number, now?: number): string;
  dateTime(timestamp: number): string;
  clock(date: Date): string;
}

const RELATIVE_STEPS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['second', 60],
  ['minute', 60],
  ['hour', 24],
  ['day', 7],
  ['week', 4.34524],
  ['month', 12],
  ['year', Number.POSITIVE_INFINITY],
];

export function createFormatters(lang: UiLang, digits: UiDigits = 'latn'): Formatters {
  const locale = localeFor(lang, digits);
  const numbers = new Intl.NumberFormat(locale);
  const twoDigits = new Intl.NumberFormat(locale, { minimumIntegerDigits: 2, useGrouping: false });
  const relative = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  const dateTime = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' });
  const clock = new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' });

  return {
    locale,
    number: (value, options) => (options ? new Intl.NumberFormat(locale, options) : numbers).format(value),
    duration(ms) {
      const total = Math.max(0, Math.round(ms / 1000));
      const h = Math.floor(total / 3600);
      const m = Math.floor((total % 3600) / 60);
      const s = total % 60;
      return h > 0
        ? `${numbers.format(h)}:${twoDigits.format(m)}:${twoDigits.format(s)}`
        : `${numbers.format(m)}:${twoDigits.format(s)}`;
    },
    relative(timestamp, now = Date.now()) {
      let value = (timestamp - now) / 1000;
      for (const [unit, size] of RELATIVE_STEPS) {
        if (Math.abs(value) < size) return relative.format(Math.round(value), unit);
        value /= size;
      }
      return relative.format(Math.round(value), 'year');
    },
    dateTime: (timestamp) => dateTime.format(timestamp),
    clock: (date) => clock.format(date),
  };
}
