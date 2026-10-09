// Run before styles or the module graph can paint a standalone card-game page.
// Explicit solo links and embedded/shared views keep their existing entry path.
(() => {
  if (window !== window.top) return;
  const game = document.documentElement.dataset.game;
  if (!['cluance', 'flip-it', 'midnight'].includes(game)) return;
  const params = new URLSearchParams(location.hash.slice(1));
  if (location.hash && params.get('together') !== '1') return;
  const url = new URL('../together/', location.href);
  url.searchParams.set('game', game);
  url.hash = location.hash;
  document.documentElement.style.visibility = 'hidden';
  location.replace(url.href);
})();
