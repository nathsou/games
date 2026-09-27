import { store } from '../game/storage.ts';

/** Synthesized sound effects (WebAudio, no assets). */
let ctx: AudioContext | null = null;
let master: GainNode | null = null;

function ac(): AudioContext | null {
  if (!store.settings.sound) return null;
  if (!ctx) {
    try {
      ctx = new AudioContext();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
    } catch {
      return null;
    }
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

/** Unlock audio on the first user gesture (required on iOS). */
export function unlockAudio(): void {
  ac();
}

let noiseBuf: AudioBuffer | null = null;
function noise(c: AudioContext): AudioBuffer {
  if (!noiseBuf) {
    noiseBuf = c.createBuffer(1, c.sampleRate * 0.3, c.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  return noiseBuf;
}

function tone(freq: number, dur: number, type: OscillatorType, vol: number, when = 0, slideTo?: number): void {
  const c = ac();
  if (!c || !master) return;
  const t = c.currentTime + when;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.02);
}

let lastBreak = 0;
export const sfx = {
  break(): void {
    const c = ac();
    if (!c || !master) return;
    const now = c.currentTime;
    if (now - lastBreak < 0.025) return;
    lastBreak = now;
    const src = c.createBufferSource();
    src.buffer = noise(c);
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.setValueAtTime(1800 + Math.random() * 900, now);
    f.frequency.exponentialRampToValueAtTime(500, now + 0.12);
    f.Q.value = 1.4;
    const g = c.createGain();
    g.gain.setValueAtTime(0.7, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    src.connect(f).connect(g).connect(master);
    src.start(now);
    src.stop(now + 0.16);
    tone(220 + Math.random() * 40, 0.08, 'triangle', 0.25, 0, 110);
  },
  paint(): void {
    tone(660 + Math.random() * 30, 0.09, 'sine', 0.18, 0, 880);
  },
  unpaint(): void {
    tone(700, 0.08, 'sine', 0.12, 0, 440);
  },
  clonk(): void {
    tone(160, 0.12, 'square', 0.08, 0, 120);
  },
  mistake(): void {
    tone(180, 0.22, 'sawtooth', 0.12, 0, 90);
    tone(140, 0.25, 'square', 0.06, 0.02, 70);
  },
  tick(): void {
    tone(1200, 0.03, 'sine', 0.06);
  },
  hint(): void {
    tone(880, 0.1, 'sine', 0.12);
    tone(1320, 0.14, 'sine', 0.1, 0.08);
  },
  win(): void {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, 0.35, 'triangle', 0.18, i * 0.09));
    tone(1567.98, 0.6, 'sine', 0.08, 0.4);
  },
  place(): void {
    tone(520 + Math.random() * 40, 0.06, 'triangle', 0.14, 0, 700);
  },
};

export function haptic(pattern: number | number[]): void {
  if (!store.settings.haptics) return;
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* unsupported */
  }
}
