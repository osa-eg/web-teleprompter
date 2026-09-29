/** Speech-recognition languages offered (Arabic varieties first; ar-SA is closest to MSA). */
export const VOICE_LANGUAGES = [
  'ar-SA',
  'ar-EG',
  'ar-AE',
  'ar-JO',
  'ar-KW',
  'ar-LB',
  'ar-QA',
  'ar-IQ',
  'ar-MA',
  'ar-DZ',
  'ar-TN',
  'en-US',
  'en-GB',
] as const;

/** "العربية (مصر)" / "Arabic (Egypt)" from the browser's own locale data. */
export function languageName(code: string, uiLang: 'ar' | 'en'): string {
  try {
    return new Intl.DisplayNames([uiLang], { type: 'language' }).of(code) ?? code;
  } catch {
    return code;
  }
}

export function speechRecognitionAvailable(): boolean {
  return typeof window !== 'undefined' && !!(window.SpeechRecognition ?? window.webkitSpeechRecognition);
}
