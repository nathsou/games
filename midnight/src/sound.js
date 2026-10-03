let context, enabled = false;
export function setSound(value) { enabled = value; }
export function sound(kind = 'tap') {
  if (!enabled) return;
  try {
    context ||= new (window.AudioContext || window.webkitAudioContext)();
    if (context.state === 'suspended') context.resume();
    const notes = kind === 'win' ? [392, 494, 587, 784] : kind === 'reveal' ? [330, 440, 660] : kind === 'deal' ? [260, 350] : [450];
    notes.forEach((frequency, i) => {
      const oscillator = context.createOscillator(), gain = context.createGain(), time = context.currentTime + i * .065;
      oscillator.type = 'triangle'; oscillator.frequency.setValueAtTime(frequency, time);
      gain.gain.setValueAtTime(0, time); gain.gain.linearRampToValueAtTime(.035, time + .006); gain.gain.exponentialRampToValueAtTime(.0001, time + .11);
      oscillator.connect(gain); gain.connect(context.destination); oscillator.start(time); oscillator.stop(time + .13);
    });
  } catch { /* Audio support is optional. */ }
}
