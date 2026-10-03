import {CARDS, DECKS} from './decks.js';

const atlases = new Map();
export async function loadArt() {
  const sources = new Map(Object.values(CARDS).map(card => [card.atlas || DECKS[card.deck].atlas, DECKS[card.deck].name]));
  await Promise.all([...sources].map(([source, name]) => new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => { atlases.set(source, img); resolve(); };
    img.onerror = () => reject(new Error(`Could not load ${name} artwork. Reload the page to try again.`));
    img.src = source;
  })));
}
function fitText(ctx, text, maxWidth, size) {
  ctx.font = `bold ${size}px "Courier New", monospace`;
  while (ctx.measureText(text).width > maxWidth && size > 7) { size -= .5; ctx.font = `bold ${size}px "Courier New", monospace`; }
}
export function drawCard(canvas, id, {label = '', secret = false} = {}) {
  const card = CARDS[id];
  if (!card) return;
  canvas.width = 288; canvas.height = 392;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const deck = DECKS[card.deck], atlas = atlases.get(card.atlas || deck.atlas);
  ctx.fillStyle = '#eddfbd'; ctx.fillRect(0, 0, 288, 392);
  ctx.fillStyle = '#243b3a'; ctx.fillRect(6, 6, 276, 380);
  ctx.fillStyle = deck.color; ctx.fillRect(12, 12, 264, 304);
  if (atlas) {
    const columns=card.columns||deck.columns, rows=card.rows||deck.rows;
    const sw = atlas.naturalWidth / columns, sh = atlas.naturalHeight / rows;
    const atlasIndex = card.atlasIndex ?? card.index;
    const x = atlasIndex % columns * sw, y = Math.floor(atlasIndex / columns) * sh;
    const ratio = 264 / 304;
    let cropW = sw, cropH = sh;
    if (sw / sh > ratio) cropW = sh * ratio;
    else cropH = sw / ratio;
    ctx.drawImage(atlas, x + (sw - cropW) / 2, y + Math.max(0,(sh - cropH) * .2), cropW, cropH, 12, 12, 264, 304);
  }
  ctx.fillStyle = '#eddfbd'; ctx.fillRect(12, 318, 264, 62);
  ctx.fillStyle = '#203331'; ctx.textAlign = 'center';
  fitText(ctx, card.name, 247, 20); ctx.fillText(card.name, 144, 337);
  fitText(ctx, card.subtitle, 247, 11); ctx.fillStyle = '#55605a'; ctx.fillText(card.subtitle, 144, 355);
  fitText(ctx, card.dates || '', 247, 12); ctx.fillStyle = '#203331'; ctx.fillText(card.dates || '', 144, 372);
  ctx.textAlign = 'left';
  if (label) {
    ctx.fillStyle = '#102a2bd9'; ctx.fillRect(17, 17, Math.max(32,label.length * 11 + 12), 28);
    ctx.fillStyle = '#f8eacb'; ctx.font = 'bold 18px "Courier New", monospace'; ctx.fillText(label, 23, 38);
  }
  if (secret) { ctx.fillStyle = '#edc878'; ctx.fillRect(145, 17, 123, 28); ctx.fillStyle = '#233335'; ctx.font = 'bold 16px "Courier New", monospace'; ctx.textAlign='center'; ctx.fillText('SECRET',207,37); }
}
// The UI uses unframed art; observationImage keeps its explicit, labelled AI view.
function drawArt(canvas,id) {
  const card=CARDS[id],deck=DECKS[card.deck],atlas=atlases.get(card.atlas||deck.atlas);
  canvas.width=300;canvas.height=400;
  const ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=false;
  ctx.fillStyle=deck.color;ctx.fillRect(0,0,300,400);
  if(!atlas)return;
  const columns=card.columns||deck.columns,rows=card.rows||deck.rows,index=card.atlasIndex??card.index;
  const sw=atlas.naturalWidth/columns,sh=atlas.naturalHeight/rows;
  const cw=Math.min(sw,sh*.75),ch=Math.min(sh,sw/.75);
  ctx.drawImage(atlas,index%columns*sw+(sw-cw)/2,Math.floor(index/columns)*sh+Math.max(0,(sh-ch)*.2),cw,ch,0,0,300,400);
}
export function cardElement(id, {interactive=false,label='',selected=false,eliminated=false,secret=false,className='',caption='m',roundTag='',onClick}={}) {
  const card=CARDS[id],el=document.createElement(interactive?'button':'div');
  el.className=['card',interactive&&'interactive',selected&&'selected',eliminated&&'eliminated',secret&&'secret',`caption-${caption}`,className].filter(Boolean).join(' ');
  el.dataset.card=id;
  const summary=[card.name,card.subtitle,card.dates].filter(Boolean).join(', ');
  el.setAttribute('aria-label',`${summary}${eliminated?', eliminated':''}${secret?', secret card':''}`);
  if(interactive){el.type='button';el.setAttribute('aria-pressed',String(selected));}else el.setAttribute('role','img');
  const art=document.createElement('span');art.className='card-art';
  const canvas=document.createElement('canvas');canvas.setAttribute('aria-hidden','true');drawArt(canvas,id);art.append(canvas);el.append(art);
  if(selected){const mark=document.createElement('span');mark.className='selection-mark';mark.textContent='✕';art.append(mark);}
  if(secret){const mark=document.createElement('span');mark.className='secret-mark';mark.textContent=caption==='none'?'★':'★ SECRET';art.append(mark);}
  if(roundTag){const mark=document.createElement('span');mark.className='round-tag';mark.textContent=roundTag;art.append(mark);}
  if(caption!=='none'){
    const name=document.createElement('span');name.className='card-name';name.textContent=(label?label+' ':'')+card.name;el.append(name);
    if(caption!=='s'){const dates=document.createElement('span');dates.className='card-dates';dates.textContent=card.dates;el.append(dates);}
  }
  if(onClick)el.addEventListener('click',onClick);
  return el;
}
export function observationImage(game, role) {
  const canvas = document.createElement('canvas');
  const hasHand = role === 'giver';
  const finalists = game.board.filter(id => !game.eliminated.includes(id));
  const comparison = game.round === 4 && game.history.length && finalists.length === 2;
  canvas.width = 1200; canvas.height = comparison ? (hasHand ? 2030 : 1720) : (hasHand ? 1510 : 1200);
  const ctx = canvas.getContext('2d'); ctx.imageSmoothingEnabled=false;
  ctx.fillStyle='#102d30'; ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle='#f2e4c5'; ctx.font='bold 24px monospace';
  ctx.fillText(`ROUND ${game.round + 1} · ${role.toUpperCase()} VIEW`,24,36);
  ctx.font='18px monospace';ctx.fillText(hasHand ? `SECRET TARGET: ${game.secret}` : 'Find the target using the public clues below.',24,68);
  const temp = document.createElement('canvas');
  for (let i=0;i<game.board.length;i++) {
    const id=game.board[i], x=24+(i%4)*292, y=94+Math.floor(i/4)*285;
    drawCard(temp,id,{label:id,secret:hasHand && id===game.secret});
    ctx.globalAlpha=game.eliminated.includes(id)?.25:1;
    ctx.drawImage(temp,x,y,192,261);ctx.globalAlpha=1;
    if (game.eliminated.includes(id)) {ctx.fillStyle='#f2c0a0';ctx.font='bold 16px monospace';ctx.fillText('ELIMINATED',x,y+133);}
  }
  ctx.fillStyle='#f2e4c5';ctx.font='bold 22px monospace';ctx.fillText('PUBLIC CLUE HISTORY',24,980);
  for (let i=0;i<game.history.length;i++) {
    const clue=game.history[i], x=24+i*232;
    drawCard(temp,clue.card,{label:clue.card});ctx.drawImage(temp,x,1000,114,155);
    ctx.fillStyle=clue.relation==='similar'?'#8bd0ad':'#f1a18f';ctx.font='bold 15px monospace';ctx.fillText(`${i+1}: ${clue.relation.toUpperCase()}`,x,1180);
  }
  if (hasHand) {
    ctx.fillStyle='#f2e4c5';ctx.font='bold 22px monospace';ctx.fillText(`YOUR HAND · ${game.variant === 'fixed' ? 'NO REFILLS' : 'REFILL AFTER PLAY'}`,24,1220);
    for (let i=0;i<game.hand.length;i++) {drawCard(temp,game.hand[i],{label:game.hand[i]});ctx.drawImage(temp,24+i*232,1240,176,240);}
  }
  if (comparison) {
    const y = hasHand ? 1540 : 1230;
    ctx.fillStyle='#f2e4c5';ctx.font='bold 22px monospace';ctx.fillText('FINAL TWO · COMPARE BOTH CARDS WITH THE LATEST CLUE',24,y);
    const latest=game.history.at(-1);
    [latest.card,...finalists].forEach((id,i)=>{
      drawCard(temp,id,{label:id,secret:hasHand && id===game.secret});
      ctx.drawImage(temp,24+i*390,y+35,288,392);
      ctx.fillStyle='#f2e4c5';ctx.font='bold 18px monospace';
      ctx.fillText(i===0?`LATEST CLUE: ${latest.relation.toUpperCase()}`:'REMAINING CANDIDATE',24+i*390,y+459);
    });
  }
  return canvas.toDataURL('image/png');
}
export function startAmbience(canvas, enabled) {
  canvas.width=120;canvas.height=80;
  const ctx=canvas.getContext('2d');let last=0;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  function frame(now) {
    if (now-last>100) {
      last=now;
      const time=enabled() && !reduced ? now/18000 : 0;
      for(let y=0;y<80;y+=2)for(let x=0;x<120;x+=2){
        const v=Math.sin(x/17+Math.sin(y/19+time)*3)+Math.cos(y/15-time+x/47);
        ctx.fillStyle=`rgb(${Math.floor(12+v*3)},${Math.floor(47+v*5)},${Math.floor(48+v*6)})`;
        ctx.fillRect(x,y,2,2);
      }
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
