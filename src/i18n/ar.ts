import type { Messages } from './en';

export const ar: Messages = {
  'app.name': 'الملقّن',
  'app.tagline': 'ملقّن نصوص احترافي بدعم كامل للعربية',

  'nav.main': 'التنقل الرئيسي',
  'nav.library': 'المكتبة',
  'nav.settings': 'الإعدادات',

  'ui.switchLanguage': 'English',
  'ui.switchLanguageLabel': 'تحويل الواجهة إلى الإنجليزية',
  'ui.language': 'لغة الواجهة',
  'ui.theme': 'السمة',
  'ui.theme.system': 'حسب النظام',
  'ui.theme.dark': 'داكنة',
  'ui.theme.light': 'فاتحة',
  'ui.themeToggle': 'السمة: {theme}',
  'ui.digits': 'الأرقام',
  'ui.digits.latn': 'غربية (123)',
  'ui.digits.arab': 'هندية (١٢٣)',

  'library.title': 'نصوصك',
  'library.new': 'نص جديد',
  'library.search': 'ابحث في النصوص',
  'library.sort': 'ترتيب حسب',
  'library.sort.updated': 'آخر تعديل',
  'library.sort.created': 'تاريخ الإنشاء',
  'library.sort.title': 'العنوان',
  'library.empty': 'لا توجد نصوص بعد. أنشئ نصك الأول!',
  'library.noResults': 'لا توجد نصوص تطابق «{query}».',
  'library.loading': 'جارٍ تحميل نصوصك…',
  'library.count': {
    zero: 'لا توجد نصوص',
    one: 'نص واحد',
    two: 'نصان',
    few: '{count} نصوص',
    many: '{count} نصاً',
    other: '{count} نص',
  },
  'library.words': {
    zero: 'لا توجد كلمات',
    one: 'كلمة واحدة',
    two: 'كلمتان',
    few: '{count} كلمات',
    many: '{count} كلمة',
    other: '{count} كلمة',
  },
  'library.duration': '≈ {duration}',
  'library.durationHint': 'مدة القراءة المتوقعة بسرعة {wpm} كلمة في الدقيقة',
  'library.edited': 'عُدّل {time}',
  'library.memoryOnly':
    'متصفحك يمنع التخزين المحلي، لذا ستُفقد النصوص عند إغلاق هذه الصفحة. صدّرها للاحتفاظ بنسخة منها.',

  'script.untitled': 'نص بدون عنوان',
  'script.copyTitle': '{title} (نسخة)',

  'action.edit': 'تحرير',
  'action.prompt': 'تشغيل',
  'action.startPrompting': 'ابدأ العرض',
  'action.duplicate': 'إنشاء نسخة',
  'action.delete': 'حذف',
  'action.undo': 'تراجع',
  'action.back': 'رجوع',
  'action.close': 'إغلاق',
  'action.reload': 'إعادة التحميل',
  'action.reset': 'إعادة الضبط',

  'toast.deleted': 'حُذف «{title}»',
  'toast.duplicated': 'أُنشئت نسخة من «{title}»',
  'toast.dbBlocked': 'إصدار أحدث من التطبيق مفتوح في تبويب آخر. أعد تحميل هذا التبويب للمتابعة.',

  'editor.title': 'العنوان',
  'editor.body': 'النص',
  'editor.bodyPlaceholder': 'اكتب نصك هنا أو الصقه…',
  'editor.saving': 'جارٍ الحفظ…',
  'editor.saved': 'تم الحفظ',
  'editor.notFound': 'هذا النص غير موجود أو تم حذفه.',
  'editor.direction': 'اتجاه النص',

  'dir.auto': 'تلقائي',
  'dir.rtl': 'من اليمين لليسار',
  'dir.ltr': 'من اليسار لليمين',

  'settings.title': 'الإعدادات',
  'settings.interface': 'الواجهة',
  'settings.resetSection': 'استعادة إعدادات هذا القسم',

  'prompter.loading': 'جارٍ تجهيز الملقّن…',

  'error.title': 'حدث خطأ ما',
  'error.notFound': 'الصفحة غير موجودة',
  'error.backToLibrary': 'العودة إلى المكتبة',
};
