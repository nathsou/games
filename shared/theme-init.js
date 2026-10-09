// Run before styles paint. Keep this tiny and dependency-free: module loading
// must not flash the default palette before the saved preference is applied.
(() => {
  let preference = 'system';
  try {
    const saved = localStorage.getItem('games-arcade:appearance');
    const value = ['light', 'dark', 'system'].includes(saved) ? saved
      : JSON.parse(localStorage.getItem('cluance-v1:settings') || localStorage.getItem('similo-arcade-v1:settings') || '{}').appearance;
    if (['light', 'dark', 'system'].includes(value)) preference = value;
  } catch { /* Storage is optional. */ }
  document.documentElement.dataset.colorTheme = preference === 'system'
    ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : preference;
})();
