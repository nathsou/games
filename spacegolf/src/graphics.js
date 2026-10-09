// Rendering preferences never change the deterministic physics simulation.
const PRESETS = {
  high: { scale: 1, maxDpr: 2, detail: 5, bloomLevels: 5, glass: true, backgroundScale: 0.5 },
  medium: { scale: 0.85, maxDpr: 1.5, detail: 3, bloomLevels: 3, glass: true, backgroundScale: 0.5 },
  low: { scale: 0.75, maxDpr: 1, detail: 2, bloomLevels: 0, glass: false, backgroundScale: 0.35 },
};

export function graphicsOptions(settings, autoLevel = 0) {
  const quality = settings.quality === 'auto' ? (autoLevel > 0 ? 'low' : 'medium') : settings.quality;
  const preset = PRESETS[quality] || PRESETS.medium;
  return {
    ...preset,
    scale: preset.scale * (settings.quality === 'auto' && autoLevel > 1 ? 0.8 : 1),
    bloomLevels: settings.bloom === false ? 0 : preset.bloomLevels,
    glass: settings.glass !== false && preset.glass,
    starsOnly: settings.background === 'stars' || quality === 'low',
    fps: settings.fps === 30 ? 30 : 60,
  };
}

// Retain the elapsed remainder so a 60 Hz display reliably presents 30 fps.
export function frameDue(now, previous, fps) {
  const interval = 1000 / fps;
  if (now - previous < interval - 0.5) return null;
  const steps = Math.max(1, Math.floor((now - previous + 0.5) / interval));
  return previous + steps * interval;
}
