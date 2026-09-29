# Web Teleprompter · الملقّن

ملقّن نصوص احترافي يعمل في المتصفح، بدعم كامل للغة العربية: اتجاه النص (يمين/يسار/تلقائي لكل سطر)،
مكتبة خطوط عربية ولاتينية، ورفع خطوطك الخاصة.

A professional teleprompter that runs in the browser, with first-class Arabic support: text direction
(right-to-left, left-to-right or automatic per line), a library of Arabic and Latin fonts, and custom
font uploads.

> 🚧 قيد التطوير على مراحل — Under active development in milestones (see the plan below).

## المزايا · Features

- **اتجاه النص**: تلقائي لكل سطر حسب أغلبية الكلمات (فـ«iPhone 17 هو أحدث هاتف» يبقى من اليمين لليسار)، أو فرض
  RTL/LTR للنص كله، مع علامات RLM/LRM لفرض اتجاه سطر بعينه. المرآة (أفقية/عمودية) مستقلة عن الاتجاه.
- **تمرير سلس بسرعة كلمة/دقيقة**: لا يتغير إيقاع القراءة عند تكبير الخط، مع تسارع ناعم، وعد تنازلي، ومدة مستهدفة،
  وإشارات توقف `[توقف]` و`[وقفة ٣]`، وأقسام للقفز بينها، وحفظ موضع القراءة.
- **خط القراءة**: شريط/خط/أسهم في جهة بداية السطر، مع تعتيم وتلاشي الحواف ومؤقت ووقت متبقٍ.
- **تحكم كامل**: لوحة المفاتيح (بالمفاتيح الفعلية فتعمل مع اللوحة العربية)، أجهزة Clicker ودواسات القدم، العجلة،
  والسحب باللمس.
- **قواعد الطباعة العربية**: لا تباعد حروف في الأسطر العربية، وتمييز بالألوان بدل الميلان المزيف، وإخفاء التشكيل
  وتحويل الأرقام عند العرض فقط.
- محرر بصيغة بسيطة (`**عريض**` `==تظليل==` `[[ملاحظة]]` `# قسم`) مع معاينة حية وإحصاءات.

---

- **Text direction**: automatic per line by majority of words, or forced RTL/LTR, with RLM/LRM overrides;
  mirroring is independent of direction.
- **Smooth words-per-minute scrolling** that keeps its pace when the font size changes, with ramping,
  countdown, target duration, pause cues, section markers and resume position.
- **Reading guide** (band, line, arrows on the line-start side), dimming, edge fades and a talent timer.
- **Controls** for keyboards (physical keys), presentation clickers, foot pedals, mouse wheel and touch.
- **Arabic typography rules**: no letter spacing on Arabic lines, colored emphasis instead of fake italics,
  optional hidden diacritics and digit conversion at render time.
- Lightweight markup editor with live preview and statistics.

## التطوير · Development

Requires Node.js ≥ 22.22.

```bash
npm install
npm run dev          # http://localhost:5173/web-teleprompter/
npm run verify       # lint + typecheck + unit tests + build + Playwright e2e
```

| Script              | Purpose                                         |
| ------------------- | ----------------------------------------------- |
| `npm run lint`      | ESLint + check that CSS uses logical properties |
| `npm run typecheck` | TypeScript project build                        |
| `npm test`          | Vitest unit (`*.test.ts`) and DOM tests         |
| `npm run e2e`       | Playwright end-to-end tests (Chromium)          |

## النشر · Deployment

The app is a static site deployed to GitHub Pages by `.github/workflows/deploy.yml` on every push to
`main`. One-time setup: **Settings → Pages → Source → GitHub Actions**. The site is then served at
`https://<owner>.github.io/web-teleprompter/`.
