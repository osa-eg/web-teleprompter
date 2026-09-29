# Web Teleprompter · الملقّن

ملقّن نصوص احترافي يعمل في المتصفح، بدعم كامل للغة العربية: اتجاه النص (يمين/يسار/تلقائي لكل سطر)،
مكتبة خطوط عربية ولاتينية، ورفع خطوطك الخاصة.

A professional teleprompter that runs in the browser, with first-class Arabic support: text direction
(right-to-left, left-to-right or automatic per line), a library of Arabic and Latin fonts, and custom
font uploads.

> 🚧 قيد التطوير على مراحل — Under active development in milestones (see the plan below).

## المزايا · Features

- مكتبة نصوص محلية (IndexedDB) مع بحث يتجاهل التشكيل واختلاف أشكال الحروف، وحفظ تلقائي.
- واجهة ثنائية اللغة (العربية/English) تنقلب تلقائياً بين RTL وLTR، مع سمة داكنة/فاتحة.
- Local script library (IndexedDB) with diacritic-insensitive search and autosave.
- Bilingual interface (Arabic/English) that flips between RTL and LTR, dark/light themes.

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
