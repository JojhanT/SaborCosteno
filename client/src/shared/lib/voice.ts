import { useSyncExternalStore } from 'react';

/*
 * Sonidos y voz para las pantallas.
 * Los navegadores bloquean el audio hasta el primer toque/clic en la página,
 * por eso las pantallas muestran un botón "Activar sonido" (o Chrome en modo
 * kiosco con --autoplay-policy=no-user-gesture-required).
 */

type Chime = 'new' | 'ready' | 'call' | 'kitchen';

let ctx: AudioContext | null = null;
let unlocked = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

function audio() {
  if (!ctx) {
    try {
      ctx = new AudioContext();
      ctx.addEventListener('statechange', notify);
    } catch {
      return null;
    }
  }
  return ctx;
}

export function isAudioReady() {
  return unlocked || audio()?.state === 'running';
}

export function useAudioReady() {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    isAudioReady,
  );
}

export function unlockAudio() {
  const c = audio();
  void c?.resume();
  try {
    const u = new SpeechSynthesisUtterance(' ');
    u.volume = 0;
    speechSynthesis.speak(u);
  } catch {
    /* sin síntesis de voz */
  }
  unlocked = true;
  notify();
}

/* ---------------------------------------------------------------- campanas */

function marimba(c: AudioContext, freq: number, at: number, out: AudioNode) {
  const partials: [number, number, number][] = [
    [1, 0.55, 1.4],
    [4, 0.14, 0.3],
    [9.2, 0.04, 0.09],
  ];
  for (const [mult, amp, decay] of partials) {
    const osc = c.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq * mult;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(amp, at + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, at + decay);
    osc.connect(g).connect(out);
    osc.start(at);
    osc.stop(at + decay + 0.05);
  }
}

const MOTIFS: Record<Chime, [number, number][]> = {
  new: [
    [659.25, 0],
    [880, 0.13],
  ],
  kitchen: [
    [523.25, 0],
    [659.25, 0.11],
    [783.99, 0.22],
    [1046.5, 0.33],
  ],
  ready: [
    [783.99, 0],
    [987.77, 0.12],
    [1174.66, 0.24],
    [1567.98, 0.4],
  ],
  call: [
    [1174.66, 0],
    [987.77, 0.16],
    [1174.66, 0.32],
    [1567.98, 0.48],
  ],
};

export function chime(kind: Chime, volume = 0.9) {
  const c = audio();
  if (!c) return;
  if (c.state === 'suspended') void c.resume();
  const master = c.createGain();
  master.gain.value = volume;
  master.connect(c.destination);
  const t0 = c.currentTime + 0.03;
  for (const [f, dt] of MOTIFS[kind]) marimba(c, f, t0 + dt, master);
}

/* -------------------------------------------------------------------- voz */

let voices: SpeechSynthesisVoice[] = [];
function loadVoices() {
  try {
    voices = speechSynthesis.getVoices();
    notify();
  } catch {
    voices = [];
  }
}
if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  loadVoices();
  speechSynthesis.addEventListener?.('voiceschanged', loadVoices);
}

const LANG_RANK = ['es-co', 'es-419', 'es-mx', 'es-us', 'es-ve', 'es-pe', 'es-ar', 'es-es'];

export function spanishVoices() {
  const rank = (v: SpeechSynthesisVoice) => {
    const lang = v.lang.toLowerCase().replace('_', '-');
    const i = LANG_RANK.indexOf(lang);
    const natural = /natural|online|neural/i.test(v.name) ? 0 : 50;
    return (i === -1 ? 20 : i) + natural;
  };
  return voices.filter((v) => v.lang.toLowerCase().startsWith('es')).sort((a, b) => rank(a) - rank(b));
}

export function fillTemplate(tpl: string, vars: Record<string, string | number | null | undefined>) {
  return tpl.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? '')).replace(/\s+,/g, ',').replace(/\s{2,}/g, ' ').trim();
}

export interface VoicePrefs {
  enabled: boolean;
  voiceURI: string;
  rate: number;
  volume: number;
}

export const DEFAULT_VOICE: VoicePrefs = { enabled: true, voiceURI: '', rate: 0.95, volume: 1 };

function speakNow(text: string, prefs: VoicePrefs): Promise<void> {
  return new Promise((resolve) => {
    if (!('speechSynthesis' in window) || !text) return resolve();
    const list = spanishVoices();
    const voice = list.find((v) => v.voiceURI === prefs.voiceURI) ?? list[0];
    const u = new SpeechSynthesisUtterance(text);
    if (voice) u.voice = voice;
    u.lang = voice?.lang ?? 'es-CO';
    u.rate = prefs.rate;
    u.volume = prefs.volume;
    const done = () => {
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(done, 9000);
    u.onend = done;
    u.onerror = done;
    speechSynthesis.resume();
    speechSynthesis.speak(u);
  });
}

/* Cola de anuncios: nunca se pisan dos anuncios (campana + voz, en orden). */
const queue: { chime?: Chime; text: string; prefs: VoicePrefs }[] = [];
let playing = false;

async function drain() {
  if (playing) return;
  playing = true;
  while (queue.length) {
    const next = queue.shift()!;
    if (next.chime) {
      chime(next.chime, next.prefs.volume);
      await new Promise((r) => setTimeout(r, next.chime === 'new' ? 450 : 750));
    }
    if (next.prefs.enabled && next.text) await speakNow(next.text, next.prefs);
    await new Promise((r) => setTimeout(r, 250));
  }
  playing = false;
}

export function announce(text: string, prefs: VoicePrefs, sound?: Chime) {
  if (queue.length > 6) queue.splice(0, queue.length - 6);
  queue.push({ chime: sound, text, prefs });
  void drain();
}
