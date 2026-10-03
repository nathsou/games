// Animate only visible cards and anonymous card backs. Never read a private hand.
const rect = node => node?.getBoundingClientRect();
export function captureTable(root) {
  const cards = new Map();
  for (const node of root.querySelectorAll('[data-visual-card]')) {
    const space = node.closest('[data-space-seat]'), hand = node.closest('[data-hand-seat]');
    cards.set(node.dataset.visualCard, {node:node.cloneNode(true), rect:rect(node), face:node.dataset.face, rank:Number(node.querySelector('.card-rank:not(.other)').textContent),
      seat:Number(space?.dataset.spaceSeat ?? hand?.dataset.handSeat), lane:space ? Number(space.dataset.spaceLane) : null});
  }
  const hands = new Map([...root.querySelectorAll('[data-hand-seat]')].map(n=>[Number(n.dataset.handSeat),rect(n)]));
  return {cards, hands};
}
export function motionEnabled() {
  return !document.body.classList.contains('no-fx') && !matchMedia('(prefers-reduced-motion: reduce)').matches && typeof Element.prototype.animate === 'function';
}
function reversedNode(original) {
  const node=original.cloneNode(true), active=node.querySelector('.card-rank:not(.other)'), reverse=node.querySelector('.card-rank.other');
  const rank=Number(reverse.textContent), next=Number(active.textContent);
  active.textContent=rank; reverse.textContent=next;
  active.classList.toggle('ten',rank===10); reverse.classList.toggle('ten',next===10);
  node.querySelector('.card-corner').innerHTML=rank+'<small>↕'+next+'</small>';
  node.querySelector('.card-emblem').textContent=['●','◆','✳','✹','✿','❖','✺','✸','♢','♜'][rank-1];
  const ink=node.style.getPropertyValue('--active-color');
  node.style.setProperty('--active-color',node.style.getPropertyValue('--reverse-color')); node.style.setProperty('--reverse-color',ink);
  return node;
}
export async function animateMove(root, before, event, ownSeat, view) {
  if (!motionEnabled() || !event) return;
  const pop=document.createElement('span');pop.className='move-pop'+(event.seat===ownSeat?'':' opponent');pop.setAttribute('aria-hidden','true');
  const returned=event.returned.reduce((n,r)=>n+r.count,0);
  pop.textContent=(event.kind==='flip'?'FLIP!':event.kind==='take'?'GRAB ×'+event.count:event.kind==='add'?'+1 → '+event.count+' × '+event.value:event.count+' × '+event.value)+(returned?'  ↩'+returned:'')+(event.cashed?'  ▤+'+event.cashed:'');
  const box=root.getBoundingClientRect();Object.assign(pop.style,{position:'fixed',left:(box.x+box.width/2)+'px',top:(box.y+box.height*.42)+'px'});
  (root.closest('dialog')||document.body).append(pop);setTimeout(()=>pop.remove(),1300);
  const after=captureTable(root), flights=[], hidden=[];
  const destination = seat => after.hands.get(seat) || rect(root.querySelector('[data-score-seat="'+seat+'"]'));
  function fly(old, next, target, index, bank=false, flip=false) {
    if (!old?.rect || !target) return;
    const node=old.node.cloneNode(true), start=old.rect;
    node.removeAttribute('data-action'); node.removeAttribute('data-visual-card'); node.removeAttribute('data-card');
    node.classList.remove('selected'); node.disabled=true; node.setAttribute('aria-hidden','true'); node.classList.add('flying-card');
    Object.assign(node.style,{position:'fixed',left:start.x+'px',top:start.y+'px',width:start.width+'px',height:start.height+'px','--card-w':start.width+'px',margin:'0',zIndex:'100',pointerEvents:'none'});
    (root.closest('dialog') || document.body).append(node);
    const dx=target.x+(target.width-start.width)/2-start.x, dy=target.y+(target.height-start.height)/2-start.y;
    const delay=Math.min(index,10)*28, duration=650;
    const finishScale=bank ? .28 : next?.rect ? target.width/start.width : .48;
    const animation=node.animate([
      {transform:'translate(0,0) scale(1)',opacity:1},
      {transform:'translate('+dx*.46+'px,'+(dy*.46-32)+'px) scale('+ (flip ? '0.02,1' : '.95') +') rotate(-8deg)',opacity:1,offset:.46},
      {transform:'translate('+dx+'px,'+dy+'px) scale('+finishScale+')',opacity:bank?0:1}
    ],{duration,delay,easing:'cubic-bezier(.2,.7,.25,1)',fill:'both'});
    let timer;
    if (next || flip) timer=setTimeout(()=>{
      if (next) {node.innerHTML=next.node.innerHTML; node.style.setProperty('--active-color',next.node.style.getPropertyValue('--active-color'));node.style.setProperty('--reverse-color',next.node.style.getPropertyValue('--reverse-color'));}
      else if (flip) { const reversed=reversedNode(node); node.innerHTML=reversed.innerHTML; node.style.setProperty('--active-color',reversed.style.getPropertyValue('--active-color'));node.style.setProperty('--reverse-color',reversed.style.getPropertyValue('--reverse-color')); }
    },delay+duration*.46);
    flights.push(animation.finished.catch(()=>{}).finally(()=>{clearTimeout(timer);node.remove();}));
  }
  let index=0;
  for (const [id,next] of after.cards) {
    const old=before.cards.get(id);
    const moved=!old || old.lane!==next.lane || old.seat!==next.seat, flipped=old && old.face!==next.face;
    if (!moved && !flipped) continue;
    const target=root.querySelector('[data-visual-card="'+id+'"]');
    target.style.visibility='hidden'; hidden.push(target);
    const source=old || {node:next.node,rect:before.hands.get(event.seat),face:next.face};
    fly(source,next,next.rect,index++,false,flipped);
  }
  for (const [id,old] of before.cards) {
    if (after.cards.has(id)) continue;
    if (old.lane===null) {
      if (event.kind==='play' && view.table[event.seat][event.lane].some(c=>c.id===id)) fly(old,null,destination(event.seat),index++);
      continue;
    }
    const bank=old.seat===event.seat && old.lane===event.lane;
    const take=event.kind==='take' && old.seat===event.targetSeat && old.lane===event.target;
    const returned=event.returned.some(r=>r.seat===old.seat && r.from===old.rank);
    if (!bank && !take && !returned) continue;
    fly(old,null,bank ? rect(root.querySelector('[data-bank]')) : destination(take ? event.seat : old.seat),index++,bank,!bank);
  }
  if (event.kind==='flip' && event.seat!==ownSeat) {
    for (const back of root.querySelectorAll('[data-hand-seat="'+event.seat+'"] .mini-back')) {
      const a=back.animate([{transform:'rotateY(0)'},{transform:'translateY(-12px) rotateY(90deg)',offset:.5},{transform:'rotateY(180deg)'}],{duration:650,delay:index++*28});
      flights.push(a.finished.catch(()=>{}));
    }
  }
  root.querySelector('.move-banner')?.classList.add('move-flash');
  if (event.cashed) root.querySelector('[data-bank]')?.classList.add('bank-flash');
  await Promise.all(flights);
  hidden.forEach(n=>n.style.removeProperty('visibility'));
}
