import { Check } from 'lucide-react';
import { useEffect, useState } from 'react';
import { pickRecordingFormat } from '@/core/recording/format';
import { listCameras } from '@/features/camera/useCameraStream';
import { useT, useFormat } from '@/i18n';
import type { Script, TextDirSetting } from '@/storage/types';
import { useLibrary } from '@/stores/library';
import {
  useSettings,
  type Appearance,
  type Behavior,
  type CameraSettings,
  type VoiceSettings,
} from '@/stores/settings';
import { Choice, ColorField, Section, Slider, Switch } from '@/ui/controls';
import { Field, Select } from '@/ui/Field';
import { languageName, speechRecognitionAvailable, VOICE_LANGUAGES } from '@/features/voice/voiceLanguages';
import { FontField } from '@/features/fonts/FontField';
import { effectiveLineHeight, weightOptions } from '@/features/fonts/fontSettings';
import { COLOR_PRESETS } from './colorPresets';
import styles from './sections.module.css';

function useAppearance() {
  const appearance = useSettings((s) => s.settings.appearance);
  const patch = useSettings((s) => s.patch);
  const set = (value: Partial<Appearance>) => patch('appearance', value);
  return [appearance, set] as const;
}

function useBehavior() {
  const behavior = useSettings((s) => s.settings.behavior);
  const patch = useSettings((s) => s.patch);
  const set = (value: Partial<Behavior>) => patch('behavior', value);
  return [behavior, set] as const;
}

interface TextSectionProps {
  /** When given, the direction control edits this script's direction. */
  script?: Script;
  /** Disables letter spacing when the script is mostly Arabic. */
  rtlDominant?: boolean;
}

export function TextSection({ script, rtlDominant }: TextSectionProps) {
  const t = useT();
  const [a, set] = useAppearance();
  const update = useLibrary((s) => s.update);
  const lineHeight = effectiveLineHeight(a);
  const weights = weightOptions(a.font);

  return (
    <Section title={t('qs.text')}>
      <FontField mode="primary" />
      <FontField mode="latin" />
      <Slider
        label={t('qs.size')}
        value={a.size}
        min={20}
        max={220}
        step={2}
        onChange={(size) => set({ size })}
      />
      {Array.isArray(weights) ? (
        <Choice
          label={t('qs.weight')}
          value={String(a.weight)}
          onChange={(weight) => set({ weight: Number(weight) })}
          options={weights.map((w) => ({ value: String(w), label: String(w) }))}
        />
      ) : (
        <Slider
          label={t('qs.weight')}
          value={a.weight}
          min={weights.min}
          max={weights.max}
          step={50}
          onChange={(weight) => set({ weight })}
        />
      )}
      <Switch
        label={t('qs.lineHeightFromFont')}
        checked={a.lineHeightFromFont}
        onChange={(lineHeightFromFont) => set({ lineHeightFromFont, lineHeight })}
      />
      <Slider
        label={t('qs.lineHeight')}
        value={lineHeight}
        min={1}
        max={3}
        step={0.05}
        disabled={a.lineHeightFromFont}
        format={(v) => v.toFixed(2)}
        onChange={(value) => set({ lineHeight: value })}
      />
      <Slider
        label={t('qs.wordSpacing')}
        value={a.wordSpacing}
        min={-0.1}
        max={1}
        step={0.02}
        format={(v) => `${v.toFixed(2)} em`}
        onChange={(wordSpacing) => set({ wordSpacing })}
      />
      <Slider
        label={t('qs.letterSpacing')}
        value={a.letterSpacing}
        min={-0.05}
        max={0.5}
        step={0.01}
        disabled={rtlDominant}
        hint={t('qs.letterSpacingHint')}
        format={(v) => `${v.toFixed(2)} em`}
        onChange={(letterSpacing) => set({ letterSpacing })}
      />
      <Slider
        label={t('qs.margins')}
        value={a.marginPct}
        min={0}
        max={30}
        onChange={(marginPct) => set({ marginPct })}
        format={(v) => `${v}%`}
      />
      <Choice
        label={t('qs.align')}
        value={a.align}
        onChange={(align) => set({ align })}
        options={[
          { value: 'start', label: t('align.start') },
          { value: 'center', label: t('align.center') },
          { value: 'end', label: t('align.end') },
          { value: 'justify', label: t('align.justify') },
        ]}
      />
      {script && (
        <Choice<TextDirSetting>
          label={t('editor.direction')}
          value={script.direction}
          onChange={(direction) => update(script.id, { direction })}
          options={[
            { value: 'auto', label: t('dir.auto') },
            { value: 'rtl', label: t('dir.rtl') },
            { value: 'ltr', label: t('dir.ltr') },
          ]}
        />
      )}
      <Switch
        label={t('qs.scaleWithWidth')}
        checked={a.scaleWithWidth}
        onChange={(scaleWithWidth) => set({ scaleWithWidth })}
      />
      <Switch
        label={t('qs.hideTashkeel')}
        checked={a.hideTashkeel}
        onChange={(hideTashkeel) => set({ hideTashkeel })}
      />
      <Choice
        label={t('qs.digits')}
        value={a.digits}
        onChange={(digits) => set({ digits })}
        options={[
          { value: 'asTyped', label: t('digits.asTyped') },
          { value: 'arab', label: t('digits.arab') },
          { value: 'latn', label: t('digits.latn') },
        ]}
      />
      <Switch label={t('qs.showNotes')} checked={a.showNotes} onChange={(showNotes) => set({ showNotes })} />
    </Section>
  );
}

export function ColorsSection() {
  const t = useT();
  const [a, set] = useAppearance();
  const setColor = (key: keyof Appearance['colors']) => (value: string) =>
    set({ colors: { ...a.colors, [key]: value } });

  return (
    <Section title={t('qs.colors')}>
      <div className={styles.presets} role="group" aria-label={t('qs.colors')}>
        {COLOR_PRESETS.map((preset) => {
          const active = preset.colors.fg === a.colors.fg && preset.colors.bg === a.colors.bg;
          return (
            <button
              key={preset.id}
              type="button"
              className={styles.preset}
              aria-pressed={active}
              title={t(preset.label)}
              style={{ background: preset.colors.bg, color: preset.colors.fg }}
              onClick={() => set({ colors: preset.colors })}
            >
              <span aria-hidden>{active ? <Check size={16} /> : 'أA'}</span>
              <span className="visually-hidden">{t(preset.label)}</span>
            </button>
          );
        })}
      </div>
      <div className={styles.colors}>
        <ColorField label={t('color.fg')} value={a.colors.fg} onChange={setColor('fg')} />
        <ColorField label={t('color.bg')} value={a.colors.bg} onChange={setColor('bg')} />
        <ColorField label={t('color.guide')} value={a.colors.guide} onChange={setColor('guide')} />
        <ColorField label={t('color.mark')} value={a.colors.mark} onChange={setColor('mark')} />
        <ColorField label={t('color.em')} value={a.colors.em} onChange={setColor('em')} />
        <ColorField label={t('color.note')} value={a.colors.note} onChange={setColor('note')} />
        <ColorField label={t('color.cue')} value={a.colors.cue} onChange={setColor('cue')} />
      </div>
    </Section>
  );
}

export function GuideSection() {
  const t = useT();
  const [a, set] = useAppearance();
  const guide = a.guide;
  const setGuide = (value: Partial<Appearance['guide']>) => set({ guide: { ...guide, ...value } });

  return (
    <Section title={t('qs.guide')}>
      <Choice
        label={t('qs.guideStyle')}
        value={guide.style}
        onChange={(style) => setGuide({ style })}
        options={[
          { value: 'band+arrows', label: t('guide.band+arrows') },
          { value: 'band', label: t('guide.band') },
          { value: 'arrows', label: t('guide.arrows') },
          { value: 'line', label: t('guide.line') },
          { value: 'none', label: t('guide.none') },
        ]}
      />
      <Slider
        label={t('qs.guidePosition')}
        value={guide.positionPct}
        min={10}
        max={60}
        format={(v) => `${v}%`}
        onChange={(positionPct) => setGuide({ positionPct })}
      />
      <Slider
        label={t('qs.guideDim')}
        value={guide.dim}
        min={0}
        max={0.8}
        step={0.05}
        format={(v) => `${Math.round(v * 100)}%`}
        onChange={(dim) => setGuide({ dim })}
      />
      {(guide.style === 'arrows' || guide.style === 'band+arrows') && (
        <Switch
          label={t('qs.guideBothSides')}
          checked={guide.bothSides}
          onChange={(bothSides) => setGuide({ bothSides })}
        />
      )}
      <Switch label={t('qs.fadeEdges')} checked={a.fadeEdges} onChange={(fadeEdges) => set({ fadeEdges })} />
      <Switch
        label={t('qs.hudVisible')}
        checked={a.hud.visible}
        onChange={(visible) => set({ hud: { ...a.hud, visible } })}
      />
    </Section>
  );
}

export function PlaybackSection() {
  const t = useT();
  const fmt = useFormat();
  const [b, set] = useBehavior();

  return (
    <Section title={t('qs.playback')}>
      <Slider
        label={t('qs.speed')}
        value={b.wpm}
        min={20}
        max={400}
        step={5}
        format={(v) => t('prompter.wpm', { wpm: v })}
        onChange={(wpm) => set({ wpm, targetDurationSec: null })}
      />
      <div className={styles.inline}>
        <label className={styles.inlineLabel} htmlFor="tp-target-duration">
          {t('qs.targetDuration')}
        </label>
        <input
          id="tp-target-duration"
          className={styles.number}
          type="number"
          min={0.5}
          max={600}
          step={0.5}
          inputMode="decimal"
          value={b.targetDurationSec ? b.targetDurationSec / 60 : ''}
          onChange={(e) => {
            const minutes = Number(e.currentTarget.value);
            set({ targetDurationSec: minutes > 0 ? Math.round(minutes * 60) : null });
          }}
        />
      </div>
      <p className={styles.hint}>{t('qs.targetDurationHint')}</p>
      <Slider
        label={t('qs.countdown')}
        value={b.countdownSec}
        min={0}
        max={10}
        onChange={(countdownSec) => set({ countdownSec })}
        format={(v) => fmt.number(v)}
      />
      <Slider
        label={t('qs.ramp')}
        value={b.rampMs}
        min={0}
        max={2000}
        step={100}
        format={(v) => `${fmt.number(v / 1000, { maximumFractionDigits: 1 })} s`}
        onChange={(rampMs) => set({ rampMs })}
      />
      <Choice
        label={t('qs.endBehavior')}
        value={b.endBehavior}
        onChange={(endBehavior) => set({ endBehavior })}
        options={[
          { value: 'stop', label: t('end.stop') },
          { value: 'loop', label: t('end.loop') },
          { value: 'scrollOut', label: t('end.scrollOut') },
        ]}
      />
      <Switch
        label={t('qs.autoPauseOnCues')}
        checked={b.autoPauseOnCues}
        onChange={(autoPauseOnCues) => set({ autoPauseOnCues })}
      />
      <Switch
        label={t('qs.pauseAtMarkers')}
        checked={b.pauseAtMarkers}
        onChange={(pauseAtMarkers) => set({ pauseAtMarkers })}
      />
      <Switch
        label={t('qs.headingsSpoken')}
        checked={b.headingsSpoken}
        onChange={(headingsSpoken) => set({ headingsSpoken })}
      />
    </Section>
  );
}

export function MirrorSection({ target = 'view', title }: { target?: 'view' | 'display'; title?: string }) {
  const t = useT();
  const mirror = useSettings((s) => s.settings[target]);
  const patch = useSettings((s) => s.patch);
  return (
    <Section title={title ?? t('qs.mirror')}>
      <Switch
        label={t('prompter.mirrorH')}
        checked={mirror.mirrorH}
        onChange={(mirrorH) => patch(target, { mirrorH })}
      />
      <Switch
        label={t('prompter.mirrorV')}
        checked={mirror.mirrorV}
        onChange={(mirrorV) => patch(target, { mirrorV })}
      />
    </Section>
  );
}

export function VoiceSection() {
  const t = useT();
  const voice = useSettings((s) => s.settings.voice);
  const uiLang = useSettings((s) => s.settings.ui.lang);
  const patch = useSettings((s) => s.patch);
  const set = (value: Partial<VoiceSettings>) => patch('voice', value);
  const codes: string[] = [...VOICE_LANGUAGES];
  if (!codes.includes(voice.lang)) codes.push(voice.lang);

  return (
    <Section title={t('voice.title')}>
      <p className={styles.hint}>{t('voice.howTo')}</p>
      <Choice<VoiceSettings['mode']>
        label={t('voice.mode')}
        value={voice.mode}
        onChange={(mode) => set({ mode })}
        options={[
          { value: 'vad', label: t('voice.mode.vad') },
          { value: 'follow', label: t('voice.mode.follow') },
        ]}
        hint={
          voice.mode === 'vad'
            ? t('voice.modeHint.vad')
            : speechRecognitionAvailable()
              ? t('voice.modeHint.follow')
              : t('voice.followUnavailable')
        }
      />
      {voice.mode === 'vad' ? (
        <Slider
          label={t('voice.sensitivity')}
          value={voice.vadSensitivityDb}
          min={4}
          max={30}
          onChange={(vadSensitivityDb) => set({ vadSensitivityDb })}
          format={(db) => t('voice.db', { db })}
          hint={t('voice.sensitivityHint')}
        />
      ) : (
        <>
          <Field label={t('voice.lang')} hint={t('voice.langHint')}>
            {(id) => (
              <Select
                id={id}
                value={voice.lang}
                onChange={(lang) => set({ lang })}
                options={codes.map((code) => ({
                  value: code,
                  label: `${languageName(code, uiLang)} (${code})`,
                }))}
              />
            )}
          </Field>
          <Slider
            label={t('voice.lookAhead')}
            value={voice.lookAheadLines}
            min={0}
            max={2}
            step={0.5}
            onChange={(lookAheadLines) => set({ lookAheadLines })}
            format={(lines) => t('voice.lines', { count: lines })}
          />
        </>
      )}
    </Section>
  );
}

const QUALITIES = [2_500_000, 5_000_000, 8_000_000, 12_000_000];

function recordingFormatLabel(preference: CameraSettings['format']): string | null {
  if (typeof MediaRecorder === 'undefined') return null;
  const format = pickRecordingFormat((type) => MediaRecorder.isTypeSupported(type), preference);
  if (!format) return null;
  return format.extension === 'mp4' ? 'MP4 (H.264)' : format.mimeType.includes('vp9') ? 'WebM (VP9)' : 'WebM';
}

export function CameraSection() {
  const t = useT();
  const camera = useSettings((s) => s.settings.camera);
  const patch = useSettings((s) => s.patch);
  const set = (value: Partial<CameraSettings>) => patch('camera', value);
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  useEffect(() => {
    let cancelled = false;
    void listCameras().then((list) => !cancelled && setCameras(list));
    return () => {
      cancelled = true;
    };
  }, []);
  const format = recordingFormatLabel(camera.format);

  return (
    <Section title={t('camera.title')}>
      <Choice<CameraSettings['layout']>
        label={t('camera.layout')}
        value={camera.layout}
        onChange={(layout) => set({ layout })}
        options={[
          { value: 'pip', label: t('camera.layout.pip') },
          { value: 'background', label: t('camera.layout.background') },
        ]}
      />
      {cameras.length > 1 && (
        <Field label={t('camera.device')}>
          {(id) => (
            <Select
              id={id}
              value={camera.deviceId ?? ''}
              onChange={(deviceId) => set({ deviceId: deviceId || null })}
              options={[
                { value: '', label: t('camera.deviceDefault') },
                ...cameras.map((device, i) => ({
                  value: device.deviceId,
                  label: device.label || `${t('camera.device')} ${i + 1}`,
                })),
              ]}
            />
          )}
        </Field>
      )}
      <Switch
        label={t('camera.mirror')}
        hint={t('camera.mirrorHint')}
        checked={camera.mirrorPreview}
        onChange={(mirrorPreview) => set({ mirrorPreview })}
      />
      <Choice<CameraSettings['format']>
        label={t('camera.format')}
        value={camera.format}
        onChange={(value) => set({ format: value })}
        options={[
          { value: 'auto', label: t('camera.format.auto') },
          { value: 'mp4', label: 'MP4' },
          { value: 'webm', label: 'WebM' },
        ]}
        hint={format ? t('camera.formatSupported', { format }) : t('camera.formatNone')}
      />
      <Choice<string>
        label={t('camera.quality')}
        value={String(camera.videoBitsPerSecond)}
        onChange={(value) => set({ videoBitsPerSecond: Number(value) })}
        options={[...new Set([...QUALITIES, camera.videoBitsPerSecond])]
          .sort((a, b) => a - b)
          .map((bits) => ({
            value: String(bits),
            label: t('camera.qualityValue', { mbps: bits / 1_000_000 }),
          }))}
      />
      <Switch
        label={t('camera.recordWithPlay')}
        hint={t('camera.recordWithPlayHint')}
        checked={camera.recordWithPlay}
        onChange={(recordWithPlay) => set({ recordWithPlay })}
      />
    </Section>
  );
}
