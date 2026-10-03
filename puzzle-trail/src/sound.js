let context, enabled = false;
export function setSound(value) { enabled = value; if (enabled && context?.state === 'suspended') context.resume().catch(() => {}); }
export function sound(kind = 'move') {
  if (!enabled || document.hidden) return;
  try {
    context ||= new (window.AudioContext || window.webkitAudioContext)();
    if (context.state === 'suspended') context.resume().catch(() => {});
    const melodies = { select: [[440,0,.035]], move: [[330,0,.06],[440,.045,.08]], capture:[[220,0,.07],[330,.06,.09]], hint:[[523,0,.08],[659,.08,.12]], error:[[180,0,.09],[150,.08,.09]], win:[[523,0,.12],[659,.12,.12],[784,.24,.12],[1047,.4,.3]], map:[[392,0,.1],[523,.08,.16]] };
    for (const [frequency, offset, duration] of melodies[kind] || melodies.move) {
      const oscillator = context.createOscillator(), gain = context.createGain(), time = context.currentTime + offset;
      oscillator.type = 'triangle'; oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0, time); gain.gain.linearRampToValueAtTime(.055, time + .008); gain.gain.exponentialRampToValueAtTime(.001, time + duration);
      oscillator.connect(gain); gain.connect(context.destination); oscillator.start(time); oscillator.stop(time + duration + .02);
    }
  } catch { enabled = false; }
}
document.addEventListener('visibilitychange', () => { if (document.hidden) context?.suspend().catch(() => {}); });
