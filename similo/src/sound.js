let context;
export function chime(kind, enabled) {
  if (!enabled || !globalThis.AudioContext) return;
  try {
    context ||= new AudioContext();
    context.resume().catch(() => {});
    const notes = kind === 'win' ? [392, 494, 587, 784] : kind === 'loss' ? [330, 277, 220] : kind === 'clue' ? [440, 660] : [520];
    notes.forEach((frequency, i) => {
      const oscillator = context.createOscillator(), gain = context.createGain(), start = context.currentTime + i * .1;
      oscillator.type = 'triangle'; oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(.035, start); gain.gain.exponentialRampToValueAtTime(.001, start + .14);
      oscillator.connect(gain); gain.connect(context.destination); oscillator.start(start); oscillator.stop(start + .16);
    });
  } catch { /* Audio is optional. */ }
}
