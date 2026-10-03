export const WORLD = { w: 2200, h: 1600, cell: 40 };
export const HOME = { x: 370, y: 830 };
export const TYPES = [
  { name: 'Ember', color: '#ef8875', light: '#ffc5a0', dark: '#a64d50', attack: 2.2, strength: 1 },
  { name: 'Tide', color: '#7abeca', light: '#c0ebde', dark: '#437b91', attack: 1, strength: 1 },
  { name: 'Honey', color: '#eac869', light: '#fff0a3', dark: '#b28c49', attack: 1, strength: 2 }
];
export function random(seed) {
  return () => { seed |= 0; seed = seed + 0x6d2b79f5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t ^= t + Math.imul(t ^ t >>> 7, 61 | t); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
export const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export function makeWorld(seed) {
  const rng = random(seed);
  const rocks = [{x:650,y:690,r:32},{x:720,y:1090,r:42},{x:990,y:900,r:35},{x:1430,y:810,r:42},{x:1680,y:850,r:36},{x:1730,y:510,r:29},{x:1860,y:1350,r:42},{x:490,y:420,r:38},{x:830,y:300,r:30}];
  const trees = [{x:190,y:450,r:35},{x:310,y:320,r:32},{x:590,y:260,r:34},{x:980,y:190,r:36},{x:1460,y:140,r:35},{x:1860,y:230,r:35},{x:2010,y:540,r:34},{x:2080,y:930,r:33},{x:2020,y:1260,r:35},{x:1510,y:1430,r:37},{x:1100,y:1390,r:34},{x:780,y:1400,r:36},{x:320,y:1320,r:38},{x:140,y:1110,r:34},{x:150,y:730,r:30}];
  const bridge = { x: 1200, y: 650, kind: 'bridge', name: 'Fallen-log bridge', r: 55, progress: 0, need: 5, done: false };
  const cargo = [
    {x:830,y:690,kind:'core',name:'The Meadow Lantern',need:6,r:24,value:5},
    {x:1650,y:350,kind:'core',name:'The Stream Lantern',need:8,r:24,value:6},
    {x:1780,y:1130,kind:'core',name:'The Hollow Lantern',need:12,r:26,value:7}
  ];
  const berries = [[540,850,3],[640,520,3],[840,1040,4],[460,1100,3],[950,450,4],[1460,660,4],[1510,1090,4],[1850,730,5],[1860,420,4]];
  berries.forEach(([x,y,need],i)=>cargo.push({x,y,kind:'berry',name:'Dewberry',need,r:14,value:3 + (i%2)}));
  const buds = [[460,700,0],[500,720,1],[490,680,2],[770,820,0],[800,800,0],[850,1170,2],[880,1190,2],[1310,650,1],[1350,630,1],[1510,420,0],[1540,430,0],[1570,420,0],[1670,1260,2],[1700,1250,2],[1730,1280,2]];
  const sprouts = buds.map(([x,y,type])=>({x,y,type,r:9,kind:'sprout',picked:false}));
  const enemies = [[980,530,40],[1580,350,65],[1670,1030,80],[1880,1100,70],[1830,710,50]].map(([x,y,hp],i)=>({x,y,homeX:x,homeY:y,r:21 + (i===2?5:0),hp,maxHp:hp,kind:'enemy',name:i===2?'Mossback bruiser':'Mossback beetle',phase:'roam',cool:1+i*.3,timer:0,angle:0,dead:false}));
  const fires = [{x:1600,y:1040,r:48},{x:1900,y:1180,r:42}];
  const decor = Array.from({length:1800},()=>({x:rng()*WORLD.w,y:rng()*WORLD.h,t:rng(),s:rng(),v:rng()}));
  cargo.forEach(c=>Object.assign(c,{delivered:false,route:null,routeAge:0,carrying:false}));
  return {seed,rocks,trees,bridge,cargo,sprouts,enemies,fires,decor};
}
export function inWater(x, y, world) {
  return x > 1120 && x < 1280 && y < 1000 && !(world.bridge.done && Math.abs(y-650)<65);
}
export function blocked(x, y, world, swim = false, radius = 9) {
  if(x<35 || y<45 || x>WORLD.w-35 || y>WORLD.h-35) return true;
  if(!swim && inWater(x,y,world)) return true;
  return [...world.rocks, ...world.trees].some(o=>Math.hypot(x-o.x,y-o.y)<o.r+radius);
}

// A shared navigation grid lets little crews take the bridge or the southern ford.
// Grid neighbors prohibit corner-cutting; a final segment is only used if it is clear.
export class Navigation {
  constructor(world) { this.world=world; this.cols=WORLD.w/WORLD.cell; this.rows=WORLD.h/WORLD.cell; this.rebuild(); }
  rebuild() {
    this.maps=[false,true].map(swim=>Array.from({length:this.cols*this.rows},(_,i)=>!blocked((i%this.cols+.5)*40,(Math.floor(i/this.cols)+.5)*40,this.world,swim,28)));
  }
  clear(a,b,swim=false) {
    const d=distance(a,b), steps=Math.ceil(d/10);
    for(let i=1;i<=steps;i++){const t=i/steps;if(blocked(a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t,this.world,swim,28))return false;}
    return true;
  }
  path(a,b,swim=false) {
    if(this.clear(a,b,swim))return [{x:b.x,y:b.y}];
    const map=this.maps[swim?1:0], cols=this.cols;
    const nearest = p => {
      const x=clamp(Math.floor(p.x/40),0,cols-1), y=clamp(Math.floor(p.y/40),0,this.rows-1);
      let best=-1, d=Infinity;
      for(let oy=-4;oy<=4;oy++)for(let ox=-4;ox<=4;ox++){const nx=x+ox,ny=y+oy,i=ny*cols+nx;if(nx<0||nx>=cols||ny<0||ny>=this.rows||!map[i])continue;const z=Math.hypot((nx+.5)*40-p.x,(ny+.5)*40-p.y);if(z<d){best=i;d=z;}}
      return best;
    };
    const start=nearest(a), end=nearest(b); if(start<0||end<0)return [];
    const heuristic=i=>Math.hypot(i%cols-end%cols,Math.floor(i/cols)-Math.floor(end/cols));
    const open=[start], closed=new Uint8Array(map.length), cost=new Float32Array(map.length).fill(Infinity), parent=new Int32Array(map.length).fill(-1);
    cost[start]=0;
    while(open.length){
      let best=0;for(let i=1;i<open.length;i++)if(cost[open[i]]+heuristic(open[i])<cost[open[best]]+heuristic(open[best]))best=i;
      const here=open.splice(best,1)[0];if(here===end){const out=[];let i=end;while(i!==start){out.unshift({x:(i%cols+.5)*40,y:(Math.floor(i/cols)+.5)*40});i=parent[i];}if(this.clear(out.at(-1)||a,b,swim))out.push({x:b.x,y:b.y});return out;}
      closed[here]=1;
      for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){
        const x=here%cols+dx,y=Math.floor(here/cols)+dy,next=y*cols+x;
        if(x<0||x>=cols||y<0||y>=this.rows||!map[next]||closed[next])continue;
        if(dx&&dy&&(!map[here+dx]||!map[here+dy*cols]))continue;
        const c=cost[here]+(dx&&dy?1.414:1);if(c>=cost[next])continue;
        cost[next]=c;parent[next]=here;if(!open.includes(next))open.push(next);
      }
    }
    return [];
  }
}
