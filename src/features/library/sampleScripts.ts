import type { UiLang } from '@/i18n/translate';
import type { Script } from '@/storage/types';

type SampleScript = Pick<Script, 'title' | 'body' | 'direction'>;

const arabic: SampleScript = {
  title: 'مرحباً بك في الملقّن',
  direction: 'auto',
  body: `# المقدمة

[[ابتسم وانظر مباشرةً إلى الكاميرا]]

مرحباً بكم جميعاً، وأهلاً وسهلاً في هذه الحلقة الجديدة.
سنتحدث اليوم عن **الملقّن الإلكتروني**، وكيف يساعد المتحدثين على الإلقاء بثقة ووضوح.

[توقف]

# كيف يعمل؟

يتحرك النص تلقائياً بسرعة تناسب إيقاع قراءتك، ويمكنك تغييرها بمفاتيح الأسهم أو بجهاز التحكم عن بعد.
ثبّت عينيك على ==خط القراءة==، واترك الباقي على الملقّن.

# لمسة أدبية

قال المتنبي: «عَلى قَدْرِ أَهْلِ العَزْمِ تَأْتي العَزائِمُ، وَتَأْتي عَلى قَدْرِ الكِرامِ المَكارِمُ».

[وقفة ٢]

# الختام

شكراً لحسن استماعكم، ونلقاكم في الحلقة القادمة بإذن الله.
`,
};

const english: SampleScript = {
  title: 'Welcome to Web Teleprompter',
  direction: 'auto',
  body: `# Opening

[[Smile and look straight into the camera]]

Hello everyone, and welcome to today's episode.
Today we're talking about **teleprompters** and how they help speakers deliver with confidence.

[pause]

# How it works

The text scrolls at a pace that matches your reading speed. Use the arrow keys or a presentation clicker to adjust it.
Keep your eyes on the ==reading line== and let the prompter do the rest.

[pause 2]

# Closing

Thanks for watching, and see you next time!
`,
};

const bilingual: SampleScript = {
  title: 'عرض ثنائي اللغة · Bilingual demo',
  direction: 'auto',
  body: `# الافتتاح · Opening

iPhone 17 هو أحدث هاتف من شركة Apple حتى الآن.
Welcome to today's presentation about the new iPhone 17.

[[انتقل إلى الشريحة التالية · Next slide]]

# الأرقام · The numbers

بلغت المبيعات ٢٥ مليون جهاز في الربع الأول من عام 2026.
Sales reached 25 million units in the first quarter of 2026.

[توقف 2]

شكراً لحسن استماعكم. Thank you for listening!
`,
};

/** Seeded on first run; ordered so the user's language comes first in the library. */
export function sampleScripts(lang: UiLang): SampleScript[] {
  return lang === 'ar' ? [arabic, bilingual, english] : [english, bilingual, arabic];
}
