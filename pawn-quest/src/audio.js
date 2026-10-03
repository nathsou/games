// Procedural chiptune sound: pulse-wave voices, noise bursts and a tiny sequencer.
let ac = null, master = null, sfxBus = null, musicBus = null;
const state = { sfx: true, music: true, song: null, timer: null, step: 0, nextTime: 0 };
const waves = {};

function ensure() {
  if (!state.unlocked) return null;
  if (!ac) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ac = new AC();
    master = ac.createGain(); master.gain.value = 0.9; master.connect(ac.destination);
    sfxBus = ac.createGain(); sfxBus.gain.value = 0.5; sfxBus.connect(master);
    musicBus = ac.createGain(); musicBus.gain.value = 0.16; musicBus.connect(master);
    for (const duty of [0.125, 0.25, 0.5]) waves[duty] = pulseWave(duty);
  }
  if (ac.state === 'suspended') ac.resume();
  return ac;
}

function pulseWave(duty) {
  const n = 64, re = new Float32Array(n), im = new Float32Array(n);
  for (let k = 1; k < n; k++) im[k] = (2 / (k * Math.PI)) * Math.sin(Math.PI * k * duty);
  return ac.createPeriodicWave(re, im);
}

const NOTE = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
export function freq(note) {
  if (typeof note === 'number') return note;
  const m = /^([A-G]#?)(\d)$/.exec(note);
  if (!m) return 0;
  return 440 * Math.pow(2, (NOTE[m[1]] + (m[2] - 4) * 12 - 9) / 12);
}

function voice({ f, f2 = null, type = 'pulse', duty = 0.25, t = 0, dur = 0.1, vol = 0.3, attack = 0.004, bus = sfxBus }) {
  if (!ac) return;
  const start = ac.currentTime + t;
  const o = ac.createOscillator();
  if (type === 'pulse') o.setPeriodicWave(waves[duty] || waves[0.25]); else o.type = type;
  o.frequency.setValueAtTime(freq(f), start);
  if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq(f2)), start + dur);
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(vol, start + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  o.connect(g); g.connect(bus);
  o.start(start); o.stop(start + dur + 0.05);
}

let noiseBuf = null;
function noise({ t = 0, dur = 0.1, vol = 0.3, hp = 800, lp = 8000, bus = sfxBus }) {
  if (!ac) return;
  if (!noiseBuf) {
    noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const start = ac.currentTime + t;
  const s = ac.createBufferSource(); s.buffer = noiseBuf;
  const h = ac.createBiquadFilter(); h.type = 'highpass'; h.frequency.value = hp;
  const l = ac.createBiquadFilter(); l.type = 'lowpass'; l.frequency.value = lp;
  const g = ac.createGain();
  g.gain.setValueAtTime(vol, start); g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  s.connect(h); h.connect(l); l.connect(g); g.connect(bus);
  s.start(start); s.stop(start + dur + 0.05);
}

const arp = (notes, step = 0.06, opts = {}) => notes.forEach((n, i) => voice({ f: n, t: i * step, dur: step * 1.6, ...opts }));

export const sfx = {
  move() { if (!state.sfx || !ensure()) return; noise({ dur: 0.05, vol: 0.25, hp: 1200, lp: 4000 }); voice({ f: 196, f2: 150, type: 'triangle', dur: 0.07, vol: 0.35 }); },
  capture() { if (!state.sfx || !ensure()) return; noise({ dur: 0.18, vol: 0.45, hp: 300, lp: 5000 }); voice({ f: 330, f2: 70, duty: 0.5, dur: 0.18, vol: 0.22 }); },
  check() { if (!state.sfx || !ensure()) return; voice({ f: 'A5', dur: 0.09, vol: 0.2 }); voice({ f: 'E5', t: 0.1, dur: 0.12, vol: 0.2 }); },
  select() { if (!state.sfx || !ensure()) return; voice({ f: 'E6', dur: 0.035, vol: 0.08, duty: 0.125 }); },
  illegal() { if (!state.sfx || !ensure()) return; voice({ f: 110, f2: 90, duty: 0.5, dur: 0.14, vol: 0.18 }); },
  star() { if (!state.sfx || !ensure()) return; arp(['E6', 'G6', 'C7'], 0.05, { duty: 0.125, vol: 0.18 }); },
  correct() { if (!state.sfx || !ensure()) return; arp(['C5', 'E5', 'G5', 'C6'], 0.06, { duty: 0.25, vol: 0.2 }); },
  wrong() { if (!state.sfx || !ensure()) return; voice({ f: 'D#4', dur: 0.12, vol: 0.18, duty: 0.5 }); voice({ f: 'A3', t: 0.12, dur: 0.22, vol: 0.18, duty: 0.5 }); },
  click() { if (!state.sfx || !ensure()) return; voice({ f: 'C6', dur: 0.03, vol: 0.08, duty: 0.125 }); },
  blip() { if (!state.sfx || !ensure()) return; voice({ f: 700 + Math.random() * 200, dur: 0.025, vol: 0.035, duty: 0.125 }); },
  promote() { if (!state.sfx || !ensure()) return; voice({ f: 'C5', f2: 'C7', dur: 0.35, vol: 0.15, duty: 0.125 }); arp(['G6', 'C7', 'E7'], 0.07, { t: 0.3, vol: 0.12, duty: 0.125 }); },
  win() {
    if (!state.sfx || !ensure()) return;
    const mel = [['C5', 0], ['E5', 0.12], ['G5', 0.24], ['C6', 0.36], ['G5', 0.6], ['C6', 0.72]];
    mel.forEach(([n, t]) => voice({ f: n, t, dur: n === 'C6' && t > 0.7 ? 0.6 : 0.14, vol: 0.2 }));
    [['C4', 0], ['G3', 0.36], ['C4', 0.72]].forEach(([n, t]) => voice({ f: n, t, dur: 0.3, type: 'triangle', vol: 0.3 }));
  },
  lose() { if (!state.sfx || !ensure()) return; [['G4', 0], ['E4', 0.18], ['C4', 0.36], ['B3', 0.54]].forEach(([n, t]) => voice({ f: n, t, dur: 0.22, vol: 0.18, duty: 0.5 })); },
  unlock() { if (!state.sfx || !ensure()) return; arp(['C6', 'E6', 'G6', 'B6', 'D7'], 0.05, { duty: 0.125, vol: 0.12 }); },
  coach() { if (!state.sfx || !ensure()) return; voice({ f: 'A5', dur: 0.06, vol: 0.08, duty: 0.25 }); voice({ f: 'D6', t: 0.07, dur: 0.08, vol: 0.08, duty: 0.25 }); },
  warn() { if (!state.sfx || !ensure()) return; voice({ f: 'F5', dur: 0.08, vol: 0.14 }); voice({ f: 'F5', t: 0.12, dur: 0.08, vol: 0.14 }); },
};

// ---------------------------------------------------------------- music
// Songs: lists of 16th-step patterns per channel. '.' = rest.
const SONGS = {
  map: {
    bpm: 112,
    chords: ['C', 'Am', 'F', 'G', 'C', 'Am', 'Dm', 'G'],
    lead: [
      'E5 . G5 . C6 . G5 E5', 'A5 . G5 E5 C5 . D5 E5', 'F5 . A5 . C6 . A5 F5', 'G5 F5 E5 D5 B4 . D5 .',
      'E5 . G5 . C6 . D6 E6', 'C6 . B5 A5 E5 . A5 .', 'F5 E5 D5 F5 A5 . G5 F5', 'D5 . G5 . B4 . . .',
    ],
  },
  battle: {
    bpm: 128,
    chords: ['Am', 'F', 'G', 'E', 'Am', 'F', 'Dm', 'E'],
    lead: [
      'A4 . C5 . E5 . D5 C5', 'F5 . E5 . C5 . A4 .', 'G4 . B4 . D5 . E5 D5', 'B4 . G#4 . E4 . . .',
      'A4 . C5 E5 A5 . G5 E5', 'F5 . A5 . C6 . A5 .', 'D5 F5 A5 . G5 F5 E5 D5', 'E5 . B4 . G#4 . E4 .',
    ],
  },
  calm: {
    bpm: 84,
    chords: ['F', 'C', 'Dm', 'A#', 'F', 'C', 'A#', 'C'],
    lead: [
      'A5 . . . C6 . A5 .', 'G5 . . . E5 . . .', 'F5 . A5 . D6 . C6 .', 'A#5 . . . D5 . . .',
      'A5 . C6 . F6 . E6 .', 'C6 . . . G5 . . .', 'F5 . D5 . A#4 . D5 .', 'E5 . . . G5 . . .',
    ],
  },
};
const CHORD = {
  C: ['C', 'E', 'G'], Am: ['A', 'C', 'E'], F: ['F', 'A', 'C'], G: ['G', 'B', 'D'], Dm: ['D', 'F', 'A'], E: ['E', 'G#', 'B'], 'A#': ['A#', 'D', 'F'],
};

function scheduleStep(song, step, time) {
  const bar = Math.floor(step / 8) % song.chords.length, beat = step % 8;
  const ch = CHORD[song.chords[bar]];
  const dur = 60 / song.bpm / 2;
  const at = time - ac.currentTime;
  // Bass: root on every eighth, octave hop on odd beats.
  voice({ f: ch[0] + (beat % 2 ? '3' : '2'), t: at, dur: dur * 0.9, type: 'triangle', vol: 0.5, bus: musicBus });
  // Arpeggio (soft, 12.5% pulse).
  voice({ f: ch[beat % 3] + '4', t: at, dur: dur * 0.5, duty: 0.125, vol: 0.12, bus: musicBus });
  // Lead.
  const notes = song.lead[bar].split(' ');
  const n = notes[beat];
  if (n && n !== '.') voice({ f: n, t: at, dur: dur * 1.7, duty: 0.25, vol: 0.2, bus: musicBus });
  if (beat === 0 || beat === 4) noise({ t: at, dur: 0.05, vol: 0.12, hp: 5000, lp: 12000, bus: musicBus });
}

function pump() {
  const song = SONGS[state.song];
  if (!song || !ac) return;
  const dur = 60 / song.bpm / 2;
  while (state.nextTime < ac.currentTime + 0.25) {
    scheduleStep(song, state.step, state.nextTime);
    state.step++;
    state.nextTime += dur;
  }
}

export function playMusic(name) {
  if (state.song === name && state.timer) return;
  state.song = name;
  stopTimer();
  if (!state.music || !name || !state.unlocked || !ensure()) return;
  state.step = 0;
  state.nextTime = ac.currentTime + 0.1;
  state.timer = setInterval(pump, 60);
}

function stopTimer() { if (state.timer) { clearInterval(state.timer); state.timer = null; } }

export function setSfx(on) { state.sfx = on; }
export function setMusic(on) {
  state.music = on;
  if (!on) stopTimer();
  else if (state.song) { const s = state.song; state.song = null; playMusic(s); }
}
export function unlockAudio() { state.unlocked = true; ensure(); if (state.music && state.song && !state.timer) { const s = state.song; state.song = null; playMusic(s); } }
