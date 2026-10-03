import { onSettingsChange, store } from '../game/storage.ts';

/**
 * Generative ambient soundscape: sparse pentatonic notes with slow attacks, a soft
 * drone and a feedback echo. Only plays while a puzzle is open and the setting is on.
 */
const SCALE = [0, 2, 4, 7, 9]; // major pentatonic
const ROOT = 146.83; // D3

class Ambient {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private echo: DelayNode | null = null;
  private drone: OscillatorNode[] = [];
  private timer = 0;
  private wanted = false;
  private playing = false;

  constructor() {
    onSettingsChange(() => this.sync());
  }

  start(): void {
    this.wanted = true;
    this.sync();
  }

  stop(): void {
    this.wanted = false;
    this.sync();
  }

  private sync(): void {
    const on = this.wanted && store.settings.ambient;
    if (on && !this.playing) this.begin();
    else if (!on && this.playing) this.end();
  }

  private setup(): AudioContext | null {
    if (this.ctx) return this.ctx;
    try {
      const ctx = new AudioContext();
      const master = ctx.createGain();
      master.gain.value = 0;
      // echo: delay with filtered feedback
      const echo = ctx.createDelay(2);
      echo.delayTime.value = 0.62;
      const fb = ctx.createGain();
      fb.gain.value = 0.38;
      const tone = ctx.createBiquadFilter();
      tone.type = 'lowpass';
      tone.frequency.value = 1600;
      echo.connect(tone).connect(fb).connect(echo);
      tone.connect(master);
      master.connect(ctx.destination);
      this.ctx = ctx;
      this.master = master;
      this.echo = echo;
      return ctx;
    } catch {
      return null;
    }
  }

  private begin(): void {
    const ctx = this.setup();
    if (!ctx || !this.master) return;
    this.playing = true;
    const resume = () => void ctx.resume();
    if (ctx.state === 'suspended') {
      resume();
      document.addEventListener('pointerdown', resume, { once: true });
    }
    const t = ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setValueAtTime(this.master.gain.value, t);
    this.master.gain.linearRampToValueAtTime(0.5, t + 3);
    // quiet root + fifth drone
    for (const f of [ROOT / 2, (ROOT * 3) / 4]) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = f;
      g.gain.value = 0.025;
      o.connect(g).connect(this.master);
      o.start();
      this.drone.push(o);
    }
    const loop = () => {
      if (!this.playing) return;
      this.note();
      if (Math.random() < 0.35) setTimeout(() => this.playing && this.note(), 400 + Math.random() * 500);
      this.timer = window.setTimeout(loop, 2200 + Math.random() * 3200);
    };
    loop();
  }

  private note(): void {
    const ctx = this.ctx;
    if (!ctx || !this.master || !this.echo) return;
    const degree = SCALE[Math.floor(Math.random() * SCALE.length)];
    const octave = Math.floor(Math.random() * 3);
    const f = ROOT * Math.pow(2, (degree + 12 * octave) / 12);
    const t = ctx.currentTime + 0.05;
    const o = ctx.createOscillator();
    const o2 = ctx.createOscillator();
    const g = ctx.createGain();
    const lp = ctx.createBiquadFilter();
    o.type = 'sine';
    o2.type = 'triangle';
    o.frequency.value = f;
    o2.frequency.value = f * 2.001;
    lp.type = 'lowpass';
    lp.frequency.value = 1400;
    const peak = 0.06 / (1 + octave * 0.4);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + 1.2);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 5.5);
    const g2 = ctx.createGain();
    g2.gain.value = 0.25;
    o.connect(g);
    o2.connect(g2).connect(g);
    g.connect(lp);
    lp.connect(this.master);
    lp.connect(this.echo);
    o.start(t);
    o2.start(t);
    o.stop(t + 6);
    o2.stop(t + 6);
  }

  private end(): void {
    this.playing = false;
    clearTimeout(this.timer);
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const t = ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setValueAtTime(this.master.gain.value, t);
    this.master.gain.linearRampToValueAtTime(0, t + 1.2);
    const drone = this.drone;
    this.drone = [];
    setTimeout(() => drone.forEach((o) => o.stop()), 1400);
  }
}

export const ambient = new Ambient();
