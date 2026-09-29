import { useT } from '@/i18n';
import type { Script } from '@/storage/types';
import {
  CameraSection,
  ColorsSection,
  GuideSection,
  MirrorSection,
  PlaybackSection,
  TextSection,
  VoiceSection,
} from '@/features/settings/sections';
import { Drawer } from './Drawer';

interface QuickSettingsProps {
  script: Script;
  rtlDominant: boolean;
  onClose: () => void;
}

/** Live display settings drawer; changes apply instantly to the stage behind it. */
export function QuickSettings({ script, rtlDominant, onClose }: QuickSettingsProps) {
  const t = useT();
  return (
    <Drawer title={t('prompter.settings')} onClose={onClose} testId="quick-settings">
      <TextSection script={script} rtlDominant={rtlDominant} />
      <GuideSection />
      <ColorsSection />
      <PlaybackSection />
      <VoiceSection />
      <CameraSection />
      <MirrorSection />
    </Drawer>
  );
}
