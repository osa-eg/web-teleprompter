import type { EngineCommand } from '@/core/commands/types';
import type { ScriptDoc } from '@/core/script/ast';
import { scriptWords, SpeechAligner } from '@/core/voice/align';
import { matchWord, speechKeys, type MatchWord } from '@/core/voice/normalize';
import { levelDb, VadMachine } from '@/core/voice/vad';

export type VoiceStatus =
  'off' | 'starting' | 'listening' | 'speaking' | 'unsupported' | 'denied' | 'network' | 'error';

export interface VoiceSettingsInput {
  mode: 'vad' | 'follow';
  lang: string;
  sensitivityDb: number;
  lookAheadLines: number;
}

interface Deps {
  dispatch: (command: EngineCommand) => void;
  /** Current token position at the reading line (to resync after jumps). */
  getPos: () => number;
  onStatus: (status: VoiceStatus) => void;
  onLevel: (level: number) => void;
}

/** Sends the RMS level of the microphone ~25 times a second, off the main thread. */
const LEVEL_WORKLET = `
class TpLevel extends AudioWorkletProcessor {
  constructor() { super(); this.sum = 0; this.count = 0; }
  process(inputs) {
    const channel = inputs[0] && inputs[0][0];
    if (channel) {
      for (let i = 0; i < channel.length; i++) this.sum += channel[i] * channel[i];
      this.count += channel.length;
    }
    if (this.count >= sampleRate / 25) {
      this.port.postMessage(Math.sqrt(this.sum / this.count));
      this.sum = 0;
      this.count = 0;
    }
    return true;
  }
}
registerProcessor('tp-level', TpLevel);
`;

const GATE_REFRESH_MS = 1000;
/** Words kept from finished recognition results for the aligner. */
const FINAL_WORDS = 16;
/** Resync the aligner when the reader is this many words away from it (a manual jump). */
const RESYNC_DISTANCE = 40;

/**
 * Voice control for the prompter:
 * - `vad`: the text scrolls at the set speed while the talent speaks and holds in silence
 *   (microphone level with an adaptive noise floor; offline, any language);
 * - `follow`: speech recognition (Chrome, Edge, Safari) finds the words being read and keeps them at
 *   the reading line, restarting by itself when the recognizer stops.
 * Everything reaches playback as engine commands, so it also drives a display window that leads.
 */
export class VoiceController {
  private readonly deps: Deps;
  private readonly doc: ScriptDoc;
  private settings: VoiceSettingsInput;
  private running = false;
  private status: VoiceStatus = 'off';
  private gateTimer: ReturnType<typeof setInterval> | null = null;
  private gateOpen = true;
  // VAD
  private stream: MediaStream | null = null;
  private audio: AudioContext | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private readonly vad = new VadMachine();
  // Speech recognition
  private recognition: SpeechRecognition | null = null;
  private aligner: SpeechAligner | null = null;
  private finalWords: MatchWord[] = [];
  private restartTimer: ReturnType<typeof setTimeout> | null = null;
  private startedAt = 0;
  private restartDelay = 0;
  private speakingTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(doc: ScriptDoc, settings: VoiceSettingsInput, deps: Deps) {
    this.doc = doc;
    this.settings = settings;
    this.deps = deps;
    this.vad.setOptions({ sensitivityDb: settings.sensitivityDb });
  }

  /** Live changes that need no restart (sensitivity, look-ahead). */
  update(settings: VoiceSettingsInput): void {
    this.settings = settings;
    this.vad.setOptions({ sensitivityDb: settings.sensitivityDb });
  }

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;
    this.setStatus('starting');
    if (this.settings.mode === 'follow') this.startRecognition();
    else await this.startVad();
    // Leadership may move between windows: keep the leader's gate right.
    this.gateTimer = setInterval(
      () => this.deps.dispatch({ type: 'voiceGate', open: this.gateOpen }),
      GATE_REFRESH_MS,
    );
  }

  stop(): void {
    if (!this.running) return;
    this.running = false;
    for (const timer of [this.restartTimer, this.speakingTimer]) if (timer) clearTimeout(timer);
    for (const timer of [this.gateTimer, this.pollTimer]) if (timer) clearInterval(timer);
    this.gateTimer = this.pollTimer = this.restartTimer = this.speakingTimer = null;
    const recognition = this.recognition;
    this.recognition = null;
    if (recognition) {
      recognition.onend = recognition.onresult = recognition.onerror = recognition.onstart = null;
      try {
        recognition.abort();
      } catch {
        // already stopped
      }
    }
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    void this.audio?.close().catch(() => undefined);
    this.audio = null;
    this.deps.dispatch({ type: 'voiceReset' });
    this.deps.onLevel(0);
    this.setStatus('off');
  }

  // ── Voice activity ───────────────────────────────────────────────────────────

  private async startVad(): Promise<void> {
    this.setGate(false);
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        // Raw levels: the detector tracks the room noise itself, and processing could flatten a voice.
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
    } catch (error) {
      this.fail(error instanceof DOMException && error.name === 'NotAllowedError' ? 'denied' : 'error');
      return;
    }
    if (!this.running) {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }
    this.stream = stream;
    const audio = new AudioContext();
    this.audio = audio;
    void audio.resume().catch(() => undefined);
    const source = audio.createMediaStreamSource(stream);
    try {
      const url = URL.createObjectURL(new Blob([LEVEL_WORKLET], { type: 'text/javascript' }));
      await audio.audioWorklet.addModule(url);
      URL.revokeObjectURL(url);
      if (!this.running) return;
      const node = new AudioWorkletNode(audio, 'tp-level');
      node.port.onmessage = (event: MessageEvent<number>) => this.onLevel(event.data);
      const mute = audio.createGain();
      mute.gain.value = 0;
      source.connect(node).connect(mute).connect(audio.destination);
    } catch {
      // No AudioWorklet: poll an analyser instead (throttled while the window is hidden).
      const analyser = audio.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);
      const samples = new Float32Array(analyser.fftSize);
      this.pollTimer = setInterval(() => {
        analyser.getFloatTimeDomainData(samples);
        this.onLevel(Math.pow(10, levelDb(samples) / 20));
      }, 40);
    }
    this.setStatus('listening');
  }

  private onLevel(rms: number): void {
    if (!this.running) return;
    const db = rms > 0 ? Math.max(-100, 20 * Math.log10(rms)) : -100;
    const speaking = this.vad.push(db, performance.now());
    this.deps.onLevel(this.vad.meter);
    if (speaking !== this.gateOpen || this.status === 'starting') {
      this.setGate(speaking);
      this.setStatus(speaking ? 'speaking' : 'listening');
    }
  }

  private setGate(open: boolean): void {
    this.gateOpen = open;
    this.deps.dispatch({ type: 'voiceGate', open });
  }

  // ── Speech recognition ───────────────────────────────────────────────────────

  private startRecognition(): void {
    const Recognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Recognition) {
      this.fail('unsupported');
      return;
    }
    // Only speech moves the text in this mode.
    this.setGate(false);
    this.aligner = new SpeechAligner(scriptWords(this.doc));
    this.aligner.resync(this.deps.getPos());
    this.listen(Recognition);
  }

  private listen(Recognition: SpeechRecognitionConstructor): void {
    if (!this.running) return;
    const recognition = new Recognition();
    recognition.lang = this.settings.lang;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => {
      if (this.status === 'starting' || this.status === 'network') this.setStatus('listening');
    };
    recognition.onresult = (event) => this.onResult(event);
    recognition.onerror = (event) => {
      if (
        event.error === 'not-allowed' ||
        event.error === 'service-not-allowed' ||
        event.error === 'audio-capture'
      ) {
        this.fail('denied');
      } else if (event.error === 'language-not-supported') {
        this.fail('error');
      } else if (event.error === 'network') {
        this.setStatus('network');
      }
      // 'no-speech' and 'aborted' just end the session; onend restarts it.
    };
    recognition.onend = () => {
      if (!this.running || this.recognition !== recognition) return;
      // Sessions end after silence or a time limit: restart, backing off if they end immediately.
      const quick = performance.now() - this.startedAt < 1000;
      this.restartDelay = quick ? Math.min(5000, Math.max(300, this.restartDelay * 2)) : 0;
      this.restartTimer = setTimeout(() => this.listen(Recognition), this.restartDelay);
    };
    this.recognition = recognition;
    this.startedAt = performance.now();
    try {
      recognition.start();
    } catch {
      this.fail('error');
    }
  }

  private onResult(event: SpeechRecognitionEvent): void {
    const locale = this.settings.lang;
    let interim = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      const text = result?.[0]?.transcript ?? '';
      if (!result || !text) continue;
      if (result.isFinal) {
        this.finalWords = [...this.finalWords, ...speechKeys(text, locale).map(matchWord)].slice(
          -FINAL_WORDS,
        );
        this.align(this.finalWords, true);
      } else {
        interim += ` ${text}`;
      }
    }
    if (interim) this.align([...this.finalWords, ...speechKeys(interim, locale).map(matchWord)], false);
    this.setStatus('speaking');
    if (this.speakingTimer) clearTimeout(this.speakingTimer);
    this.speakingTimer = setTimeout(() => this.running && this.setStatus('listening'), 1500);
  }

  private align(words: MatchWord[], final: boolean): void {
    const aligner = this.aligner;
    if (!aligner) return;
    const pos = this.deps.getPos();
    if (Math.abs(pos - (aligner.token + 1)) > RESYNC_DISTANCE) aligner.resync(pos);
    const token = aligner.match(words, final);
    if (token === null) return;
    this.deps.dispatch({
      type: 'voiceTrack',
      pos: token + 1,
      lead: this.settings.lookAheadLines,
      word: token,
    });
  }

  // ── Status ───────────────────────────────────────────────────────────────────

  private fail(status: VoiceStatus): void {
    const running = this.running;
    this.stop();
    if (running) this.setStatus(status);
  }

  private setStatus(status: VoiceStatus): void {
    if (status === this.status) return;
    this.status = status;
    this.deps.onStatus(status);
  }
}
