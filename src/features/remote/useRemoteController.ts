import { useEffect, useMemo, useRef } from 'react';
import type { Command } from '@/core/commands/types';
import type { EngineStatus } from '@/core/engine/types';
import type { ScriptInfo } from '@/core/remote/protocol';
import type { ScriptDoc } from '@/core/script/ast';
import type { ViewSettings } from '@/stores/settingsSchema';
import { attachRemoteController, publishRemoteState } from './hostService';

interface Options {
  enabled: boolean;
  title: string;
  doc: ScriptDoc;
  status: EngineStatus;
  fontSize: number;
  mirror: ViewSettings;
  canChangeLook: boolean;
  onCommand: (command: Command) => void;
}

/** Offers this prompter to connected phones: its script, its state and its commands. */
export function useRemoteController({
  enabled,
  title,
  doc,
  status,
  fontSize,
  mirror,
  canChangeLook,
  onCommand,
}: Options): void {
  const onCommandRef = useRef(onCommand);
  useEffect(() => {
    onCommandRef.current = onCommand;
  });

  const script = useMemo<ScriptInfo>(
    () => ({
      title: title.slice(0, 200),
      dir: doc.dominantDir,
      markers: doc.markers.slice(0, 500).map((m) => ({ title: m.title.slice(0, 120), level: m.level })),
    }),
    [title, doc],
  );

  useEffect(() => {
    if (!enabled) return;
    return attachRemoteController({ script, onCommand: (command) => onCommandRef.current(command) });
  }, [enabled, script]);

  useEffect(() => {
    if (!enabled) return;
    publishRemoteState({
      play: status.play,
      holding: status.holding,
      progress: Math.min(1, Math.max(0, status.progress)),
      wpm: status.wpm,
      elapsedMs: status.elapsedMs,
      remainingMs: status.remainingMs,
      marker: status.marker,
      countdown: status.countdown,
      fontSize,
      mirrorH: mirror.mirrorH,
      mirrorV: mirror.mirrorV,
      canChangeLook,
    });
  }, [enabled, status, fontSize, mirror, canChangeLook]);
}
