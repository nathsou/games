import { App } from './app.js';
import { TitleScene } from './scenes/title.js';
import { installNavigation } from './nav.js';

const canvas = document.getElementById('game');

function fail(message) {
  // WebGL2 is required; with no GL context we can still paint a message with 2D.
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  if (!ctx) return;
  ctx.fillStyle = '#050816';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#eaf1ff';
  ctx.font = '600 22px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Spacegolf needs WebGL2', canvas.width / 2, canvas.height / 2 - 12);
  ctx.fillStyle = '#9db0d8';
  ctx.font = '15px system-ui, sans-serif';
  ctx.fillText(String(message).slice(0, 120), canvas.width / 2, canvas.height / 2 + 18);
}

try {
  const app = new App(canvas);
  window.spacegolf = app;
  installNavigation(app);
  app.go(new TitleScene(app), true);
  app.routeFromHash();
  app.start();
} catch (e) {
  console.error(e);
  fail(e && e.message ? e.message : e);
}
