// Animated pixel sky behind every screen: night with twinkling stars, or day with clouds.
const PX = 4; // CSS pixels per sky pixel

export function startSky(canvas) {
  canvas.__friendDraw = {type: 'sky'};
  const ctx = canvas.getContext('2d');
  let w = 0, h = 0, stars = [], clouds = [], hills = [];
  const light = () => document.documentElement.dataset.colorTheme === 'light';

  function resize() {
    w = Math.ceil(innerWidth / PX); h = Math.ceil(innerHeight / PX);
    canvas.width = w; canvas.height = h;
    let seed = 7;
    const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    stars = Array.from({ length: Math.floor(w * h / 90) }, () => ({ x: Math.floor(r() * w), y: Math.floor(r() * h * 0.75), p: r() * 6.28, s: r() < 0.08 ? 2 : 1 }));
    clouds = Array.from({ length: 6 }, () => ({ x: r() * w, y: 8 + r() * h * 0.4, w: 20 + r() * 30, v: 0.02 + r() * 0.04 }));
    hills = [];
    for (let layer = 0; layer < 3; layer++) {
      const pts = [];
      let y = h * (0.72 + layer * 0.08);
      for (let x = 0; x <= w; x += 2) { y += (r() - 0.5) * (3 - layer); y = Math.max(h * (0.6 + layer * 0.08), Math.min(h * (0.86 + layer * 0.04), y)); pts.push(Math.round(y)); }
      hills.push(pts);
    }
  }

  function draw(t) {
    const day = light();
    const g = ctx.createLinearGradient(0, 0, 0, h);
    if (day) { g.addColorStop(0, '#8fd0ff'); g.addColorStop(0.7, '#d8f0ff'); g.addColorStop(1, '#fff3d6'); }
    else { g.addColorStop(0, '#0b0820'); g.addColorStop(0.6, '#1d1450'); g.addColorStop(1, '#3a2266'); }
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    if (!day) {
      for (const s of stars) {
        const a = 0.35 + 0.65 * Math.abs(Math.sin(t / 1400 + s.p));
        ctx.fillStyle = `rgba(255,255,255,${a})`;
        ctx.fillRect(s.x, s.y, s.s, s.s);
      }
      // Moon
      ctx.fillStyle = '#fff4c8'; ctx.beginPath(); ctx.arc(w * 0.82, h * 0.18, 9, 0, 7); ctx.fill();
      ctx.fillStyle = '#e8d8a0'; ctx.fillRect(Math.round(w * 0.82) - 3, Math.round(h * 0.18) - 2, 2, 2); ctx.fillRect(Math.round(w * 0.82) + 2, Math.round(h * 0.18) + 3, 3, 2);
    } else {
      ctx.fillStyle = '#fff6b0'; ctx.beginPath(); ctx.arc(w * 0.85, h * 0.16, 10, 0, 7); ctx.fill();
    }
    for (const c of clouds) {
      c.x += c.v; if (c.x > w + 40) c.x = -60;
      ctx.fillStyle = day ? 'rgba(255,255,255,0.9)' : 'rgba(120,100,200,0.18)';
      const x = Math.round(c.x), y = Math.round(c.y), cw = Math.round(c.w);
      ctx.fillRect(x, y, cw, 4); ctx.fillRect(x + 4, y - 3, cw - 10, 3); ctx.fillRect(x + 8, y - 5, cw / 3, 2);
    }
    const hillCols = day ? ['#a8d8a0', '#7cc07a', '#5aa860'] : ['#2a1e5c', '#221749', '#170f36'];
    hills.forEach((pts, i) => {
      ctx.fillStyle = hillCols[i];
      pts.forEach((y, k) => ctx.fillRect(k * 2, y, 2, h - y));
    });
  }

  let last = 0;
  function loop(t) {
    if (t - last > 90) { draw(t); last = t; }
    requestAnimationFrame(loop);
  }
  addEventListener('resize', resize);
  resize();
  requestAnimationFrame(loop);
}
