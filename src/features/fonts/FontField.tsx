import { useT } from '@/i18n';
import { useSettings, type FontRef } from '@/stores/settings';
import { Choice } from '@/ui/controls';
import { SYSTEM_FONT_CHOICES } from './fontSettings';

const encode = (ref: FontRef) =>
  ref.kind === 'catalog' || ref.kind === 'custom' ? `${ref.kind}:${ref.id}` : `${ref.kind}:${ref.family}`;

function decode(value: string): FontRef {
  const [kind, ...rest] = value.split(':');
  const name = rest.join(':');
  if (kind === 'catalog' || kind === 'custom') return { kind, id: name };
  return { kind: kind === 'local' ? 'local' : 'system', family: name };
}

/** Font selector (bundled font + common system fonts). */
export function FontField() {
  const t = useT();
  const font = useSettings((s) => s.settings.appearance.font);
  const patch = useSettings((s) => s.patch);
  const current = encode(font);
  const options = [
    { value: 'catalog:cairo', label: 'Cairo — القاهرة' },
    ...SYSTEM_FONT_CHOICES.map((family) => ({ value: `system:${family}`, label: family })),
  ];
  if (!options.some((o) => o.value === current))
    options.push({ value: current, label: current.split(':')[1] ?? current });

  return (
    <Choice
      label={t('qs.font')}
      value={current}
      options={options}
      onChange={(v) => patch('appearance', { font: decode(v) })}
    />
  );
}
