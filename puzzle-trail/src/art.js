export function pieceSVG(type, color = 'w') {
  const ivory = color === 'w', fill = ivory ? '#f6ead0' : '#8e7aac', shade = ivory ? '#c5ad81' : '#594971', outline = ivory ? '#4b493e' : '#292638', shine = ivory ? '#fff8e5' : '#b6a1d2';
  const shapes = {
    p: '<path d="M15 5h10v3h3v10h-3v3h-10v-3h-3V8h3z"/><path d="M17 21h6v8h4v5h4v7H9v-7h4v-5h4z"/>',
    r: '<path d="M7 6h7v7h3V6h6v7h3V6h7v15h-5v5h-3v8h6v7H9v-7h6v-8h-3v-5H7z"/><path d="M13 21h14" fill="none"/>',
    b: '<path d="M19 3h3v4h4v4h4v10h-4v4H14v-4h-4v-8h4V8h5z"/><path d="M17 25h6v7h5v3h3v6H9v-6h3v-3h5z"/><path d="M23 10l-7 9" fill="none"/>',
    n: '<path d="M15 5h9v4h6v5h4v11H23v-5h-7v5h3v5h7v4h5v7H9v-7h3v-8H8V15h4V9h3z"/><path d="M23 12h4v4h-4z" fill="'+outline+'" stroke="none"/><path d="M11 18h7" fill="none"/>',
    q: '<path d="M5 7h5l4 8 6-10 6 10 4-8h5l-5 19H10z"/><path d="M15 26h10v7h4v3h3v5H8v-5h3v-3h4z"/><path d="M12 21h16" fill="none"/>',
    k: '<path d="M17 2h6v5h5v6h-5v5h-6v-5h-5V7h5z"/><path d="M10 18h20v8h-5v7h4v3h3v5H8v-5h3v-3h4v-7h-5z"/><path d="M14 22h12" fill="none"/>'
  };
  return `<svg class="piece piece-${type} piece-${color}" viewBox="0 0 40 48" aria-hidden="true"><path d="M7 42h26v4H7z" fill="#102e2a" opacity=".23"/><g fill="${fill}" stroke="${outline}" stroke-width="2.2" stroke-linejoin="round">${shapes[type] || shapes.p}</g><path d="M11 38h18v2H11z" fill="${shade}"/><path d="M13 35h11v2H13z" fill="${shine}" opacity=".7"/></svg>`;
}
export function lanternSVG(lit = true) {
  return `<svg class="lantern-icon" viewBox="0 0 32 40" aria-hidden="true"><path d="M12 4h8v4h4v5h-4v-3h-8v3H8V8h4z" fill="${lit ? '#f7d78e' : '#6b8777'}"/><path d="M7 13h18v4h-2v14h2v4H7v-4h2V17H7z" fill="${lit ? '#d39b53' : '#587267'}"/><path d="M12 18h8v12h-8z" fill="${lit ? '#ffebac' : '#213e35'}"/><path d="M14 21h4v7h-4z" fill="${lit ? '#fff8d9' : '#38594a'}"/><path d="M11 35h10v3H11z" fill="${lit ? '#d39b53' : '#587267'}"/></svg>`;
}
export function guideSVG() {
  return `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M8 53h48v7H8z" fill="#112f2b"/><path d="M18 25h28v11h5v21H13V36h5z" fill="#c38858"/><path d="M18 26h7v28h-7zM39 26h7v28h-7z" fill="#855437"/><path d="M14 9h9v5h18V9h9v9h4v22h-8v7H18v-7h-8V18h4z" fill="#e6c494"/><path d="M14 19h15v18H14zM35 19h15v18H35z" fill="#fff0c9"/><path d="M19 23h6v9h-6zM39 23h6v9h-6z" fill="#16372f"/><path d="M20 23h2v3h-2zM40 23h2v3h-2z" fill="#fff"/><path d="M29 30h6v9h-6z" fill="#c78b48"/><path d="M20 43h24v6H20z" fill="#769b83"/><path d="M36 46h6v11h-6z" fill="#a4b08c"/><path d="M24 52h6v9h-6zM34 52h6v9h-6z" fill="#d6ae78"/></svg>`;
}
const noise = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const tree = (x, y, style = 0) => `<g transform="translate(${x} ${y})"><path d="M-4 11h8v15h-8z" fill="#775d3d"/><path d="M-17 2h34v12h-34zM-13-11h26v14h-26zM-8-21h16v12H-8z" fill="${style ? '#3f7352' : '#2d624c'}"/><path d="M-8-19h7v9h-7zM-12-9h9v9h-9zM-15 4h10v5h-10z" fill="${style ? '#65936a' : '#4c8461'}"/><path d="M3 5h12v7H3z" fill="#24523f"/></g>`;
export function worldSVG(restored = [], focus = null) {
  let flora = '';
  const landmarks = [[115,270],[290,185],[430,300],[590,150],[745,280],[880,170]];
  for (let i = 0; i < 135; i++) {
    const x = Math.round(noise(i + 2) * 980) + 10, y = Math.round(noise(i + 240) * 410) + 10;
    if (landmarks.some(([lx,ly]) => Math.hypot(x-lx,y-ly) < 65) || (x > 650 && x < 730) || (x > 505 && y < 170)) continue;
    flora += i % 3 === 0 ? tree(x,y,i%2) : `<path d="M${x} ${y}h3v-6h3v6h3v3h-9z" fill="${i%4 ? '#487652' : '#b6ad76'}" opacity=".7"/>`;
  }
  let places = '';
  landmarks.forEach(([x,y],i) => {
    const active = restored.includes(i), lit = active || i === focus;
    let building = '';
    if (i === 0) building = '<path d="M-35 15h70v10h-70zM-22 5h44v10h-44z" fill="#a99a68"/><path d="M-8-27h16v30h-16z" fill="#927147"/><path d="M-16-27h32v-6h-32zM-12-48h24v21h-24z" fill="#d2aa67"/><path d="M-7-43h14v12H-7z" fill="'+(lit?'#fff0aa':'#405a4a')+'"/>';
    if (i === 1) building = '<path d="M-43 8h86v12h-86zM-35-2h70v10h-70z" fill="#9b7950"/><path d="M-36-14h6v32h-6zM30-14h6v32h-6z" fill="#cbab75"/><path d="M-35-10h70v4h-70z" fill="#d0ac70"/>';
    if (i === 2) building = '<path d="M-33 16h66v9h-66zM-25-22h50v38h-50z" fill="#a8b6a1"/><path d="M-31-26h62v6h-62zM-21-36h42v10h-42zM-10-46h20v10h-20z" fill="#79958a"/><path d="M-9-10h18v26H-9z" fill="#27483e"/><path d="M-4-27h8v9h-8z" fill="'+(lit?'#fbe7b6':'#526c60')+'"/>';
    if (i === 3) building = '<path d="M-57 17h51v-16h-8v-18h-10v-17h-9v17h-10v18h-8zM5 17h62v-14h-9v-18H48v-19H38v-17H28v17H18v19H9v18H5z" fill="#6b797a"/><path d="M-33-34h9v17h-9zM28-51h10v17H28zM18-34h30v17H18z" fill="#c0c5ad"/><path d="M-10 17h27v9h-27z" fill="#ad9a75"/>';
    if (i === 4) building = '<path d="M-39 20h78v6h-78zM-31 8h62v12h-62z" fill="#b19b65"/><path d="M-24-12h48v20h-48zM-32-16h64v7h-64zM-23-26h46v10h-46z" fill="#7f8c69"/><path d="M-4-2h8v10h-8z" fill="#274a41"/><path d="M-37 6h9v-13h-9zM28 6h9v-13h-9z" fill="#d6b077"/>';
    if (i === 5) building = '<path d="M-39 24h78v7h-78zM-29-19h58v43h-58z" fill="#a6b5a4"/><path d="M-35-21h70v-8h-70zM-26-29h52v-12h-52zM-15-41h30v-9h-30zM-6-50h12v-8H-6z" fill="'+(lit?'#a5b89a':'#69897c')+'"/><path d="M-10-3h20v27h-20z" fill="#24453e"/><path d="M-20-12h9v11h-9zM11-12h9v11h-9z" fill="'+(lit?'#f6d48a':'#38594d')+'"/><path d="M3-55h23v6H3zM16-65h10v10H16z" fill="#d3b778"/>';
    places += `<g transform="translate(${x} ${y})" opacity="${lit ? 1 : .57}"><ellipse cy="25" rx="48" ry="11" fill="#112f29" opacity=".4"/>${building}${active ? '<path d="M-43-34h4v-4h4v4h4v4h-4v4h-4v-4h-4zM34-47h3v-3h3v3h3v3h-3v3h-3v-3h-3z" fill="#edd59b"/>' : ''}</g>`;
  });
  const view = focus === null ? '0 0 1000 440' : `${Math.max(0, Math.min(590, landmarks[focus][0]-205))} ${Math.max(0, Math.min(305,landmarks[focus][1]-70))} 410 135`;
  return `<svg class="world-art" viewBox="${view}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" preserveAspectRatio="xMidYMid slice"><rect width="1000" height="440" fill="#244c3c"/><path d="M0 30h180v28h94v-18h175v21h210v-30h190v40h151v-71H0zM0 351h120v-21h185v43h114v-16h159v-32h101v41h211v-15h110v89H0z" fill="#315a40"/><path d="M664 0h60v57h-18v64h21v52h-29v55h-19v61h35v45h24v54h-61v52h-54v-50h22v-49h-18v-68h23v-57h17v-48h-15v-61h17V0z" fill="#244c50"/><path d="M691 0h9v59h-17v66h20v44h-25v59h-18v58h32v53h24v41h-22v60" fill="none" stroke="#487473" stroke-width="4" opacity=".6"/><path d="M0 280h70v18h37v49h-39v24H0zM930 0v53h-36v24h-28v37h134V0z" fill="#3b6550"/>${flora}<path d="M115 270C160 250 190 170 290 185S340 315 430 300S475 125 590 150S650 310 745 280S805 160 880 170" fill="none" stroke="#142e29" stroke-width="18"/><path d="M115 270C160 250 190 170 290 185S340 315 430 300S475 125 590 150S650 310 745 280S805 160 880 170" fill="none" stroke="#ad9e6e" stroke-width="9" stroke-dasharray="8 7" opacity=".8"/>${places}<g fill="#a9c9a4" opacity=".7"><path d="M70 80h3v-3h3v3h3v3h-3v3h-3v-3h-3zM385 100h3v-3h3v3h3v3h-3v3h-3v-3h-3zM815 375h3v-3h3v3h3v3h-3v3h-3v-3h-3z"/></g></svg>`;
}
