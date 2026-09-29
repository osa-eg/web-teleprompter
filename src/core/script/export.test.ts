import { describe, expect, it } from 'vitest';
import { docToPlainText } from './export';
import { parseScript } from './parse';

describe('docToPlainText', () => {
  it('drops markup, notes and cues but keeps structure', () => {
    const doc = parseScript(
      '# المقدمة\n\n[[ابتسم]] مرحباً **بكم** في ==الحلقة== [توقف]\nسطر ثانٍ\n\n[pause 2]\n\nThe *end*.',
    );
    expect(docToPlainText(doc)).toBe('المقدمة\n\nمرحباً بكم في الحلقة\nسطر ثانٍ\n\nThe end.');
  });
});
