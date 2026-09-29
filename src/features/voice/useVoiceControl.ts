import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { ScrollEngine } from '@/core/engine/ScrollEngine';
import type { ScriptDoc } from '@/core/script/ast';
import { VoiceController, type VoiceSettingsInput, type VoiceStatus } from './VoiceController';

/** Microphone level (0…1) for the meter, updated ~25 times a second outside React state. */
export class LevelStore {
  private level = 0;
  private readonly listeners = new Set<() => void>();
  get = () => this.level;
  set(level: number) {
    if (Math.abs(level - this.level) < 0.01) return;
    this.level = level;
    for (const listener of this.listeners) listener();
  }
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
}

export function useLevel(store: LevelStore): number {
  return useSyncExternalStore(store.subscribe, store.get);
}

const CONSENT_KEY = 'tp:voice-consent';

export function hasSpeechConsent(): boolean {
  try {
    return localStorage.getItem(CONSENT_KEY) === '1';
  } catch {
    return false;
  }
}

export function giveSpeechConsent(): void {
  try {
    localStorage.setItem(CONSENT_KEY, '1');
  } catch {
    // Not persisted: asked again next time.
  }
}

interface Options {
  active: boolean;
  settings: VoiceSettingsInput;
  doc: ScriptDoc;
  engine: ScrollEngine;
}

/** Runs voice control while `active`; restarts when the mode, language or script changes. */
export function useVoiceControl({ active, settings, doc, engine }: Options): {
  status: VoiceStatus;
  level: LevelStore;
} {
  const [status, setStatus] = useState<VoiceStatus>('off');
  const [level] = useState(() => new LevelStore());
  const controllerRef = useRef<VoiceController | null>(null);
  const settingsRef = useRef(settings);
  useEffect(() => {
    settingsRef.current = settings;
    controllerRef.current?.update(settings);
  });

  const { mode, lang } = settings;
  useEffect(() => {
    if (!active) return;
    const controller = new VoiceController(
      doc,
      { ...settingsRef.current, mode, lang },
      {
        dispatch: (command) => engine.dispatch(command),
        getPos: () => engine.getPos(),
        onStatus: setStatus,
        onLevel: (value) => level.set(value),
      },
    );
    controllerRef.current = controller;
    void controller.start();
    return () => {
      controllerRef.current = null;
      controller.stop();
    };
  }, [active, mode, lang, doc, engine, level]);

  return { status: active ? status : 'off', level };
}
