import clsx from 'clsx';
import {
  HardDrive,
  Info,
  Keyboard,
  Mic,
  Monitor,
  Palette,
  Play,
  Save,
  SlidersHorizontal,
  Smartphone,
  Video,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { NavLink, useParams } from 'react-router';
import { useT, type MessageKey } from '@/i18n';
import { useSettings, type UiSettings } from '@/stores/settings';
import { Choice, Section } from '@/ui/controls';
import { AboutPanel } from './AboutPanel';
import { KeymapEditor } from './KeymapEditor';
import { PresetsPanel } from './PresetsPanel';
import { RemoteSettings } from './RemoteSettings';
import {
  CameraSection,
  ColorsSection,
  GuideSection,
  MirrorSection,
  PlaybackSection,
  TextSection,
  VoiceSection,
} from './sections';
import { StoragePanel } from './StoragePanel';
import styles from './SettingsPage.module.css';

function InterfaceSection() {
  const t = useT();
  const ui = useSettings((s) => s.settings.ui);
  const patch = useSettings((s) => s.patch);
  return (
    <Section title={t('settings.interface')}>
      <Choice<UiSettings['lang']>
        label={t('ui.language')}
        value={ui.lang}
        onChange={(lang) => patch('ui', { lang })}
        options={[
          { value: 'ar', label: 'العربية' },
          { value: 'en', label: 'English' },
        ]}
      />
      <Choice<UiSettings['theme']>
        label={t('ui.theme')}
        value={ui.theme}
        onChange={(theme) => patch('ui', { theme })}
        options={[
          { value: 'system', label: t('ui.theme.system') },
          { value: 'dark', label: t('ui.theme.dark') },
          { value: 'light', label: t('ui.theme.light') },
        ]}
      />
      {ui.lang === 'ar' && (
        <Choice<UiSettings['digits']>
          label={t('ui.digits')}
          value={ui.digits}
          onChange={(digits) => patch('ui', { digits })}
          options={[
            { value: 'latn', label: t('ui.digits.latn') },
            { value: 'arab', label: t('ui.digits.arab') },
          ]}
        />
      )}
    </Section>
  );
}

function MirrorSections() {
  const t = useT();
  return (
    <>
      <MirrorSection />
      <MirrorSection target="display" title={t('display.mirror')} />
    </>
  );
}

interface SectionDef {
  id: string;
  label: MessageKey;
  icon: ReactNode;
  render: () => ReactNode;
}

const SECTIONS: SectionDef[] = [
  {
    id: 'interface',
    label: 'settings.interface',
    icon: <SlidersHorizontal size={18} />,
    render: () => <InterfaceSection />,
  },
  {
    id: 'display',
    label: 'settings.display',
    icon: <Palette size={18} />,
    render: () => (
      <>
        <TextSection />
        <ColorsSection />
        <GuideSection />
      </>
    ),
  },
  {
    id: 'playback',
    label: 'qs.playback',
    icon: <Play size={18} />,
    render: () => <PlaybackSection />,
  },
  { id: 'voice', label: 'voice.title', icon: <Mic size={18} />, render: () => <VoiceSection /> },
  { id: 'camera', label: 'camera.title', icon: <Video size={18} />, render: () => <CameraSection /> },
  {
    id: 'mirror',
    label: 'qs.mirror',
    icon: <Monitor size={18} />,
    render: () => <MirrorSections />,
  },
  {
    id: 'keyboard',
    label: 'settings.keyboard',
    icon: <Keyboard size={18} />,
    render: () => <KeymapEditor />,
  },
  {
    id: 'remote',
    label: 'settings.remote',
    icon: <Smartphone size={18} />,
    render: () => <RemoteSettings />,
  },
  { id: 'presets', label: 'settings.presets', icon: <Save size={18} />, render: () => <PresetsPanel /> },
  { id: 'storage', label: 'settings.storage', icon: <HardDrive size={18} />, render: () => <StoragePanel /> },
  { id: 'about', label: 'settings.about', icon: <Info size={18} />, render: () => <AboutPanel /> },
];

export function SettingsPage() {
  const t = useT();
  const { section = 'interface' } = useParams();
  const current = SECTIONS.find((s) => s.id === section) ?? SECTIONS[0]!;

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>{t('settings.title')}</h1>
      <div className={styles.layout}>
        <nav className={styles.nav} aria-label={t('settings.nav')}>
          {SECTIONS.map((s) => (
            <NavLink
              key={s.id}
              to={`/settings/${s.id}`}
              className={clsx(styles.navLink, s.id === current.id && styles.active)}
              aria-current={s.id === current.id ? 'page' : undefined}
            >
              <span aria-hidden>{s.icon}</span>
              <span>{t(s.label)}</span>
            </NavLink>
          ))}
        </nav>
        <div className={styles.content} data-testid={`settings-${current.id}`}>
          {current.render()}
        </div>
      </div>
    </div>
  );
}
