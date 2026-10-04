// A short canvas celebration or falling-card effect, with no persistent animation.
export function animateOutcome(canvas, result, enabled) {
  if(!enabled||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  const bounds=canvas.getBoundingClientRect(),ratio=Math.min(devicePixelRatio||1,2);
  const width=bounds.width,height=bounds.height;if(!width||!height)return;
  canvas.width=Math.ceil(width*ratio);canvas.height=Math.ceil(height*ratio);
  const ctx=canvas.getContext('2d');ctx.scale(ratio,ratio);
  const win=result==='win',colors=win?['#efbf70','#9dceb0','#eddfbd','#a9c1e1']:['#d87f71','#a95652','#94706a'];
  const particles=Array.from({length:win?100:45},()=>({
    x:win?width/2:Math.random()*width,y:win?height*.55:-20-Math.random()*height*.4,
    vx:(Math.random()-.5)*(win?260:50),vy:win?-130-Math.random()*180:35+Math.random()*50,
    rotation:Math.random()*Math.PI,speed:(Math.random()-.5)*7,size:win?4+Math.random()*5:8+Math.random()*9,
    delay:Math.random()*.35,color:colors[Math.floor(Math.random()*colors.length)],
  }));
  const start=performance.now();
  function draw(now){
    const elapsed=(now-start)/1000;
    if(elapsed>5||!canvas.isConnected||!canvas.closest('dialog')?.open){ctx.clearRect(0,0,width,height);return;}
    ctx.clearRect(0,0,width,height);
    for(const p of particles){
      const t=elapsed-p.delay;if(t<0)continue;
      ctx.save();ctx.globalAlpha=Math.max(0,Math.min(win?.85:.5,5-elapsed));
      ctx.translate(p.x+p.vx*t,p.y+p.vy*t+(win?70:30)*t*t);ctx.rotate(p.rotation+p.speed*t);
      ctx.fillStyle=p.color;ctx.fillRect(-p.size/2,-p.size/2,p.size,win?p.size*.55:p.size*1.4);ctx.restore();
    }
    requestAnimationFrame(draw);
  }
  requestAnimationFrame(draw);
}
