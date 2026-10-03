// Procedural sound: everything is synthesised with WebAudio, no audio files.

export class Sound {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.master = null;
    this.hum = null;
    this.pad = null;
    this.focused = true; // sound is silenced while the tab or window is in the background
  }

  // browsers only allow audio after a user gesture, so this is called from input handlers
  unlock() {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.enabled && this.focused ? 0.55 : 0;
        const comp = this.ctx.createDynamicsCompressor();
        this.master.connect(comp);
        comp.connect(this.ctx.destination);
        const len = this.ctx.sampleRate;
        this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const d = this.noiseBuf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        this._startPad();
        this._startHum();
      }
      if (this.ctx.state === 'suspended' && this.focused) this.ctx.resume();
    } catch (e) {
      this.ctx = null;
    }
  }

  setEnabled(on) {
    this.enabled = on;
    this._applyGain();
  }

  // Called when the tab/window gains or loses focus: mute and pause the audio clock while away.
  setFocused(focused) {
    if (focused === this.focused) return;
    this.focused = focused;
    this._applyGain();
    if (!this.ctx) return;
    try {
      if (focused) this.ctx.resume();
      else setTimeout(() => { if (!this.focused && this.ctx) this.ctx.suspend(); }, 120);
    } catch (e) { /* ignore */ }
  }

  _applyGain() {
    if (this.master) this.master.gain.setTargetAtTime(this.enabled && this.focused ? 0.55 : 0, this.ctx.currentTime, 0.04);
  }

  get ok() {
    return this.ctx && this.enabled && this.focused;
  }

  _env(g, t, attack, dur, peak) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  }

  tone({ type = 'sine', f0 = 440, f1 = f0, dur = 0.2, gain = 0.2, attack = 0.005, delay = 0, curve = 'exp' }) {
    if (!this.ok) return;
    const c = this.ctx;
    const t = c.currentTime + delay;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) {
      if (curve === 'exp') o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
      else o.frequency.linearRampToValueAtTime(f1, t + dur);
    }
    this._env(g, t, attack, dur, gain);
    o.connect(g);
    g.connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  noise({ dur = 0.2, gain = 0.2, f0 = 800, f1 = f0, q = 1, type = 'bandpass', delay = 0, attack = 0.01 }) {
    if (!this.ok) return;
    const c = this.ctx;
    const t = c.currentTime + delay;
    const s = c.createBufferSource();
    s.buffer = this.noiseBuf;
    s.loop = true;
    const f = c.createBiquadFilter();
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
    const g = c.createGain();
    this._env(g, t, attack, dur, gain);
    s.connect(f);
    f.connect(g);
    g.connect(this.master);
    s.start(t);
    s.stop(t + dur + 0.05);
  }

  click() {
    this.tone({ type: 'sine', f0: 700, f1: 980, dur: 0.06, gain: 0.07 });
  }

  back() {
    this.tone({ type: 'sine', f0: 520, f1: 360, dur: 0.07, gain: 0.07 });
  }

  shoot(power) {
    this.noise({ dur: 0.32, gain: 0.16 + power * 0.1, f0: 300, f1: 900 + power * 2600, q: 1.4 });
    this.tone({ type: 'triangle', f0: 130 + power * 60, f1: 340 + power * 260, dur: 0.22, gain: 0.16 });
  }

  bounce(speed, surface) {
    const v = Math.min(1, speed / 420);
    if (surface === 'rubber') {
      this.tone({ type: 'sine', f0: 200 + v * 120, f1: 520, dur: 0.22, gain: 0.12 + v * 0.1 });
    } else if (surface === 'ice') {
      this.tone({ type: 'sine', f0: 1500, f1: 1100, dur: 0.16, gain: 0.05 + v * 0.07 });
      this.noise({ dur: 0.05, gain: 0.05, f0: 5000, type: 'highpass' });
    } else {
      this.tone({ type: 'triangle', f0: 150 + v * 60, f1: 55, dur: 0.14, gain: 0.08 + v * 0.18 });
      this.noise({ dur: 0.06, gain: 0.05 + v * 0.07, f0: 700, q: 0.8 });
    }
  }

  splat() {
    this.tone({ type: 'sine', f0: 240, f1: 70, dur: 0.18, gain: 0.18 });
    this.noise({ dur: 0.12, gain: 0.08, f0: 500, f1: 200, q: 0.7 });
  }

  rest() {
    this.tone({ type: 'sine', f0: 260, f1: 200, dur: 0.1, gain: 0.05 });
  }

  star(n = 0) {
    const f = 880 * Math.pow(1.122, n);
    this.tone({ type: 'sine', f0: f, f1: f * 1.5, dur: 0.18, gain: 0.14 });
    this.tone({ type: 'sine', f0: f * 2, dur: 0.3, gain: 0.07, delay: 0.07 });
  }

  lost(reason) {
    if (reason === 'swallowed') {
      this.tone({ type: 'sawtooth', f0: 520, f1: 40, dur: 0.7, gain: 0.12 });
      this.noise({ dur: 0.7, gain: 0.1, f0: 2000, f1: 90, q: 2 });
    } else if (reason === 'burned') {
      this.noise({ dur: 0.5, gain: 0.2, f0: 3000, f1: 400, q: 0.6 });
      this.tone({ type: 'sawtooth', f0: 300, f1: 60, dur: 0.4, gain: 0.08 });
    } else {
      this.tone({ type: 'triangle', f0: 400, f1: 90, dur: 0.6, gain: 0.12 });
    }
  }

  portal() {
    this.noise({ dur: 0.35, gain: 0.12, f0: 500, f1: 3000, q: 3 });
    this.tone({ type: 'sine', f0: 300, f1: 1100, dur: 0.3, gain: 0.1 });
  }

  capture() {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f, i) => this.tone({ type: 'triangle', f0: f, dur: 0.5, gain: 0.16, delay: i * 0.08 }));
    this.tone({ type: 'sine', f0: 130, f1: 60, dur: 0.4, gain: 0.2 });
  }

  win(stars) {
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5, 1568];
    const n = 3 + stars * 1;
    for (let i = 0; i < Math.min(notes.length, n); i++) {
      this.tone({ type: 'triangle', f0: notes[i], dur: 0.6, gain: 0.12, delay: 0.25 + i * 0.1 });
      this.tone({ type: 'sine', f0: notes[i] * 2, dur: 0.5, gain: 0.04, delay: 0.25 + i * 0.1 });
    }
  }

  // gravity hum: level is 0..1, follows the pull on the ball while it flies
  setHum(level) {
    if (!this.ctx || !this.hum) return;
    const t = this.ctx.currentTime;
    const l = this.enabled && this.focused ? Math.min(1, Math.max(0, level)) : 0;
    this.hum.gain.gain.setTargetAtTime(l * 0.09, t, 0.08);
    this.hum.osc.frequency.setTargetAtTime(55 + l * 120, t, 0.1);
    this.hum.filter.frequency.setTargetAtTime(200 + l * 900, t, 0.1);
  }

  _startHum() {
    const c = this.ctx;
    const osc = c.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = 55;
    const filter = c.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 200;
    const gain = c.createGain();
    gain.gain.value = 0;
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    osc.start();
    this.hum = { osc, filter, gain };
  }

  _startPad() {
    const c = this.ctx;
    const out = c.createGain();
    out.gain.value = 0.05;
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 520;
    lp.connect(out);
    out.connect(this.master);
    [110, 164.81, 246.94, 329.63].forEach((f, i) => {
      const o = c.createOscillator();
      o.type = i % 2 ? 'sine' : 'triangle';
      o.frequency.value = f * (1 + (i - 1.5) * 0.002);
      const g = c.createGain();
      g.gain.value = 0.5;
      const lfo = c.createOscillator();
      lfo.frequency.value = 0.05 + i * 0.03;
      const lg = c.createGain();
      lg.gain.value = 0.35;
      lfo.connect(lg);
      lg.connect(g.gain);
      o.connect(g);
      g.connect(lp);
      o.start();
      lfo.start();
    });
    this.pad = out;
  }
}
