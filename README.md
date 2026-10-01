# Web Teleprompter · الملقّن

ملقّن نصوص احترافي يعمل في المتصفح، بدعم كامل للغة العربية: اتجاه النص (يمين/يسار/تلقائي لكل سطر)،
مكتبة خطوط عربية ولاتينية، ورفع خطوطك الخاصة.

A professional teleprompter that runs in the browser, with first-class Arabic support: text direction
(right-to-left, left-to-right or automatic per line), a library of Arabic and Latin fonts, and custom
font uploads.

## المزايا · Features

- **اتجاه النص**: تلقائي لكل سطر حسب أغلبية الكلمات (فـ«iPhone 17 هو أحدث هاتف» يبقى من اليمين لليسار)، أو فرض
  RTL/LTR للنص كله، مع علامات RLM/LRM لفرض اتجاه سطر بعينه. المرآة (أفقية/عمودية) مستقلة عن الاتجاه.
- **تمرير سلس بسرعة كلمة/دقيقة**: لا يتغير إيقاع القراءة عند تكبير الخط، مع تسارع ناعم، وعد تنازلي، ومدة مستهدفة،
  وإشارات توقف `[توقف]` و`[وقفة ٣]`، وأقسام للقفز بينها، وحفظ موضع القراءة.
- **ملء الشاشة على اللابتوب والموبايل**: زر ⛶ بجوار التشغيل (أو مفتاح F)، وشريط تحكم من صف واحد في الوضع الأفقي،
  وفي ملء الشاشة يختفي الشريط تلقائياً فيبقى النص وحده. على iPhone أضِف الملقّن إلى الشاشة الرئيسية ليعمل بلا أشرطة.
- **خط القراءة**: شريط/خط/أسهم في جهة بداية السطر، مع تعتيم وتلاشي الحواف ومؤقت ووقت متبقٍ.
- **تحكم كامل**: لوحة المفاتيح (بالمفاتيح الفعلية فتعمل مع اللوحة العربية)، أجهزة Clicker ودواسات القدم، العجلة،
  والسحب باللمس.
- **قواعد الطباعة العربية**: لا تباعد حروف في الأسطر العربية، وتمييز بالألوان بدل الميلان المزيف، وإخفاء التشكيل
  وتحويل الأرقام عند العرض فقط.
- **الخطوط**: 46 خطاً عربياً (حديث، كوفي، نسخ، رقعة، نستعليق، عناوين، يدوي) + 10 خطوط لاتينية، مستضافة ذاتياً
  وتُحمّل عند الحاجة فقط، مع معاينة حية وبحث وتصنيف، وارتفاع سطر مناسب لكل خط، وخط لاتيني منفصل اختياري للنصوص
  المختلطة، ورفع خطوطك الخاصة (TTF/OTF/WOFF/WOFF2)، واستخدام خطوط الجهاز.
- محرر بصيغة بسيطة (`**عريض**` `==تظليل==` `[[ملاحظة]]` `# قسم`) مع معاينة حية وإحصاءات.
- **الاستيراد والتصدير**: ملفات `.txt` و`.md` و`.docx` (Word) بالسحب والإفلات، مع كشف الترميز تلقائياً
  (UTF-8/UTF-16 وملفات Windows العربية القديمة windows-1256)، ولصق ذكي من صفحات الويب وWord يحافظ على العناوين
  والتنسيق (Ctrl+Shift+V للنص الخام)، وتصدير النص `.txt`/`.md`، ونسخة احتياطية كاملة `.json` تشمل الإعدادات
  والخطوط المخصصة.
- **أدوات تنظيف العربية**: إصلاح الحروف المنسوخة من PDF (أشكال العرض ﻣﺮﺣﺒﺎ ← مرحبا مع إبقاء ﷺ)، إزالة علامات
  الاتجاه الشاردة، دمج الأسطر المكسورة، إزالة التشكيل، وتحويل الأرقام.
- **صفحة إعدادات كاملة**: محرر اختصارات لوحة المفاتيح بالتقاط المفتاح وحل التعارضات، قوالب جاهزة للـClicker
  والدواسة، مظاهر محفوظة، حالة التخزين، وتراخيص الخطوط.
- **نافذة عرض ثانية**: افتح النص في نافذة منفصلة لشاشة الملقّن تتحرك متزامنةً مع نافذة التحكم، بإعداد مرآة مستقل،
  وملء الشاشة الأخرى مباشرةً في Chrome/Edge، وتنتقل تلقائياً إلى النص الذي تفتحه في نافذة التحكم. النافذة التي يقرأ
  منها المقدم هي التي تدير التمرير، فلا يتوقف النص إن أُخفيت نافذة التحكم.
- **التحكم من الهاتف**: امسح رمز QR بكاميرا الهاتف دون تثبيت أي تطبيق: تشغيل/إيقاف، السرعة، الفقرات والأقسام، حجم
  الخط والمرآة، مع الوقت والتقدم. الاتصال مباشر ومشفّر (WebRTC) ومحمي بمفتاح سري في الرابط، حتى 3 هواتف، مع إعادة
  اتصال تلقائية وخيار خادم PeerJS وخوادم TURN خاصة.
- **أزرار الوسائط**: خواتم Bluetooth والسماعات وأزرار الوسائط في لوحة المفاتيح تتحكم بالملقّن حتى والنافذة غير نشطة.
- **التمرير بالصوت**: وضع «التمرير أثناء الكلام» يعمل دون إنترنت وبأي لغة (يتحرك النص أثناء كلامك ويتوقف حين
  تصمت، مع عتبة قابلة للضبط فوق ضوضاء المكان)، ووضع «متابعة كلماتي» يتعرّف على الكلمات المقروءة ويبقيها عند خط
  القراءة مع تمييز الكلمة المنطوقة، بمطابقة عربية مرنة (التشكيل والهمزات والتاء المربوطة وأدوات التعريف والعطف) وبدعم
  اللهجات العربية والإنجليزية.
- **الكاميرا والتسجيل**: معاينة الكاميرا خلف النص (مع تعتيم وظل للنص) أو في نافذة صغيرة قابلة للسحب، معكوسة كالمرآة
  بينما يُحفظ التسجيل بالاتجاه الصحيح؛ تسجيل MP4 أو WebM حسب دعم المتصفح (مع إصلاح مدة ملفات WebM)، يبدأ مع نهاية العد
  التنازلي ويتوقف عند نهاية النص إن شئت، ويُحفظ باسم `teleprompter-YYYYMMDD-HHmm`.
- **تطبيق قابل للتثبيت يعمل دون إنترنت (PWA)**: الواجهة وخط Cairo مخزّنان مسبقاً، وكل خط يُستخدم مرة يبقى متاحاً،
  مع زر لإتاحة كل الخطوط دون إنترنت، وإشعار التحديث لا يظهر أثناء القراءة.

---

- **Text direction**: automatic per line by majority of words, or forced RTL/LTR, with RLM/LRM overrides;
  mirroring is independent of direction.
- **Smooth words-per-minute scrolling** that keeps its pace when the font size changes, with ramping,
  countdown, target duration, pause cues, section markers and resume position.
- **Full screen on laptops and phones**: a ⛶ button next to play (or the F key), one-row controls in
  landscape, and in full screen the controls slide away so only the text remains. On iPhone, add the prompter
  to the Home Screen to run it without browser bars.
- **Reading guide** (band, line, arrows on the line-start side), dimming, edge fades and a talent timer.
- **Controls** for keyboards (physical keys), presentation clickers, foot pedals, mouse wheel and touch.
- **Arabic typography rules**: no letter spacing on Arabic lines, colored emphasis instead of fake italics,
  optional hidden diacritics and digit conversion at render time.
- **Fonts**: 46 Arabic fonts (modern, Kufi, Naskh, Ruqaa, Nastaliq, display, handwriting) and 10 Latin
  fonts, self-hosted and lazy-loaded, with live previews, search, per-font line heights, an optional
  separate Latin font for mixed scripts, custom font uploads and fonts installed on the device.
- Lightweight markup editor with live preview and statistics.
- **Import and export**: `.txt`, `.md` and Word `.docx` files (drag and drop), automatic encoding
  detection (UTF-8/UTF-16 and legacy Windows-1256 Arabic files), smart paste that keeps headings and
  emphasis (Ctrl+Shift+V pastes plain text), `.txt`/`.md` export and full `.json` backups including
  settings and custom fonts.
- **Arabic clean-up tools**: fix text copied from PDFs (presentation forms, keeping word ligatures such
  as ﷺ), strip stray direction marks, join hand-wrapped lines, remove diacritics and convert digits.
- **Full settings page**: a keyboard shortcut editor with key capture and conflict handling, clicker and
  pedal presets, saved looks, storage status and font licenses.
- **Second display window**: open the text in a separate window for the teleprompter monitor. It scrolls in
  step with the operator window, has its own mirroring, can go full screen on the other screen (Chrome/Edge)
  and follows the operator to the next script. The window the talent reads from runs the scroll, so hiding the
  operator window never stalls the text.
- **Phone remote**: scan a QR code, no app needed — play/pause, speed, paragraphs and sections, text size and
  mirroring, with time and progress. Direct, encrypted WebRTC connection protected by a secret key in the
  link; up to 3 phones, automatic reconnection, optional private PeerJS server and TURN servers.
- **Media buttons**: Bluetooth rings, headsets and keyboard media keys control the prompter, even while
  another window is active.
- **Voice scrolling**: “Scroll while I speak” works offline in any language (the text moves while you speak
  and holds when you pause, with an adjustable threshold above the room noise); “Follow my words” uses speech
  recognition to keep the words you read at the reading line and highlights the word just said, with
  forgiving Arabic matching (diacritics, hamza and teh-marbuta variants, clitics) and Arabic dialects or
  English.
- **Camera and recording**: a camera preview behind the text (dimmed, with shadowed text) or in a small
  draggable window, mirrored like a mirror while recordings keep the right orientation; MP4 or WebM recording
  depending on the browser (WebM files get their duration fixed), optionally starting when the countdown ends
  and stopping at the end of the script, saved as `teleprompter-YYYYMMDD-HHmm`.
- **Installable offline app (PWA)**: the app shell and the Cairo font are precached, every font you use is
  cached for offline use, and update prompts never interrupt a live read.

## التطوير · Development

Requires Node.js ≥ 22.22.

```bash
npm install
npm run dev          # http://localhost:5173/web-teleprompter/
npm run verify       # lint + typecheck + unit tests + build + Playwright e2e
```

The phone-remote end-to-end tests start a local PeerJS signaling server (`npx peerjs`) next to the preview
server. To try the remote with a real phone during development, run `npm run dev -- --host` and set
**Settings → Remote control → Address phones open** to the LAN address shown by Vite.

| Script              | Purpose                                                      |
| ------------------- | ------------------------------------------------------------ |
| `npm run lint`      | ESLint + check that CSS uses logical properties              |
| `npm run typecheck` | TypeScript project build                                     |
| `npm test`          | Vitest unit (`*.test.ts`) and DOM tests                      |
| `npm run e2e`       | Playwright end-to-end tests (Chromium)                       |
| `npm run fonts:gen` | Regenerate the font catalog from `scripts/fonts.config.json` |

## النشر · Deployment

The app is a static site deployed to GitHub Pages by `.github/workflows/deploy.yml` on every push to
`main`. One-time setup: **Settings → Pages → Source → GitHub Actions**. The site is then served at
`https://<owner>.github.io/web-teleprompter/`.
