// All GLSL lives here. Everything is procedural: no textures are loaded
// (the only texture is the glyph atlas rasterised at startup).
//
// Rendering is HDR: sprites may output values above 1.0 (suns, lava, the hole
// rim...) and the composite pass blooms them and rolls them off filmically.

const NOISE = /* glsl */ `
float sq(float x){ return x*x; }
float hash21(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*.1031); p3 += dot(p3, p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
vec2 hash22(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*vec3(.1031,.1030,.0973)); p3 += dot(p3, p3.yzx+33.33); return fract((p3.xx+p3.yz)*p3.zy); }
vec3 hash33(vec3 p3){ p3 = fract(p3*vec3(.1031,.1030,.0973)); p3 += dot(p3, p3.yxz+33.33); return fract((p3.xxy+p3.yxx)*p3.zyx); }
float hash31(vec3 p){ p = fract(p*.1031); p += dot(p, p.zyx+31.32); return fract((p.x+p.y)*p.z); }
float gnoise2(vec2 p){
  vec2 i=floor(p), f=fract(p); vec2 u=f*f*f*(f*(f*6.0-15.0)+10.0);
  float a=dot(hash22(i)*2.0-1.0, f);
  float b=dot(hash22(i+vec2(1,0))*2.0-1.0, f-vec2(1,0));
  float c=dot(hash22(i+vec2(0,1))*2.0-1.0, f-vec2(0,1));
  float d=dot(hash22(i+vec2(1,1))*2.0-1.0, f-vec2(1,1));
  return mix(mix(a,b,u.x), mix(c,d,u.x), u.y)*1.41;
}
float gnoise(vec3 p){
  vec3 i=floor(p), f=fract(p); vec3 u=f*f*f*(f*(f*6.0-15.0)+10.0);
  #define G(o) dot(hash33(i+o)*2.0-1.0, f-o)
  return mix(
    mix(mix(G(vec3(0,0,0)),G(vec3(1,0,0)),u.x), mix(G(vec3(0,1,0)),G(vec3(1,1,0)),u.x), u.y),
    mix(mix(G(vec3(0,0,1)),G(vec3(1,0,1)),u.x), mix(G(vec3(0,1,1)),G(vec3(1,1,1)),u.x), u.y), u.z)*1.15;
}
const mat2 R2 = mat2(0.8,0.6,-0.6,0.8);
const mat3 R3 = mat3(0.00,0.80,0.60,-0.80,0.36,-0.48,-0.60,-0.48,0.64);
float fbm2(vec2 p){ float a=0.5,s=0.0; for(int i=0;i<5;i++){ s+=a*gnoise2(p); p=R2*p*2.03+vec2(5.3,1.7); a*=0.5; } return clamp(s*0.9+0.5, 0.0, 1.0); }
float gDetail = 5.0; // octaves worth evaluating at the current on-screen size (avoids aliasing speckle)
float fbm3(vec3 p){ float a=0.5,s=0.0; for(int i=0;i<5;i++){ if(float(i)>=gDetail) break; s+=a*clamp(gDetail-float(i),0.0,1.0)*gnoise(p); p=R3*p*2.02+vec3(1.7,9.2,3.1); a*=0.5; } return clamp(s*0.9+0.5, 0.0, 1.0); }
float sdStar5(vec2 p, float r, float rf){
  const vec2 k1 = vec2(0.809016994375, -0.587785252292);
  const vec2 k2 = vec2(-k1.x, k1.y);
  p.x = abs(p.x);
  p -= 2.0*max(dot(k1,p),0.0)*k1;
  p -= 2.0*max(dot(k2,p),0.0)*k2;
  p.x = abs(p.x);
  p.y -= r;
  vec2 ba = rf*vec2(-k1.y,k1.x) - vec2(0,1);
  float h = clamp(dot(p,ba)/dot(ba,ba), 0.0, r);
  return length(p-ba*h) * sign(p.y*ba.x-p.x*ba.y);
}
float sdSeg(vec2 p, vec2 a, vec2 b){ vec2 pa=p-a, ba=b-a; float h=clamp(dot(pa,ba)/max(dot(ba,ba),1e-8),0.0,1.0); return length(pa-ba*h); }
`;

// ---------------------------------------------------------------------------
// World objects: instanced quads, one fragment shader that switches on type.
// ---------------------------------------------------------------------------

export const OBJ_VS = /* glsl */ `#version 300 es
layout(location=0) in vec2 aCorner;
layout(location=1) in vec4 aA; // cx, cy, ext, rad
layout(location=2) in vec4 aB; // type, seed, p1, p2
layout(location=3) in vec4 aC; // colour
uniform vec2 uRes;
uniform vec3 uCam; // cx, cy, pixels per world unit
out vec2 vP;
flat out vec4 vA;
flat out vec4 vB;
flat out vec4 vC;
void main(){
  vec2 world = aA.xy + aCorner*aA.z;
  vec2 px = (world - uCam.xy)*uCam.z + uRes*0.5;
  vec2 ndc = px/uRes*2.0-1.0; ndc.y = -ndc.y;
  gl_Position = vec4(ndc,0.0,1.0);
  vP = aCorner*aA.z; vA=aA; vB=aB; vC=aC;
}`;

export const OBJ_FS = /* glsl */ `#version 300 es
precision highp float;
in vec2 vP;
flat in vec4 vA;
flat in vec4 vB;
flat in vec4 vC;
uniform float uTime;
uniform vec3 uCam;
uniform vec3 uLight;
uniform float uDetail;
uniform vec3 uSun; // world x, y, active
out vec4 o;
${NOISE}

float aaw(){ return 1.0/uCam.z; }
vec3 hueMix(vec3 c, float seed, float amt){ return mix(c, c.gbr, fract(seed*7.31)*amt); }
vec3 spin(vec3 v, float a){ float c=cos(a), s=sin(a); return vec3(v.x*c+v.z*s, v.y, -v.x*s+v.z*c); }

// nearest jittered feature point in a 2x2x2 neighbourhood: (distance, cell id)
vec2 vor(vec3 p){
  vec3 b = floor(p-0.5);
  float best = 9.0, id = 0.0;
  for (int k=0;k<8;k++){
    vec3 o = vec3(float(k&1), float((k>>1)&1), float((k>>2)&1));
    vec3 c = b+o;
    vec3 h = hash33(c);
    vec3 pt = c + 0.5 + (h-0.5)*0.6;
    float d = length(p-pt);
    if (d<best){ best=d; id=h.x*7.0+h.y*3.0+h.z; }
  }
  return vec2(best, id);
}
float crater(vec2 v){
  float r = 0.13 + 0.17*fract(v.y*7.13);
  float bowl = (1.0-smoothstep(r*0.1, r, v.x));
  float rim = exp(-sq((v.x-r)/(r*0.2)));
  return rim*0.55 - bowl*0.9;
}

float gHi = 1.0;    // fades fine detail (cities, small craters, bubbles) out on small planets

float heightOf(int look, vec3 sp, float seed){
  vec3 so = vec3(seed*1.7, seed*0.37, seed*2.9);
  if (look==0) { float f=fbm3(sp*2.4+so); return f*0.25 + crater(vor(sp*2.2+so))*0.55 + crater(vor(sp*5.0+so*1.3))*0.35 + crater(vor(sp*11.0+so*0.7))*0.2*gHi; }
  if (look==1) { float h=fbm3(sp*1.8+so)*1.2-0.1; return smoothstep(0.5,0.53,h)*h*0.6; }
  if (look==2) { float f=sp.y*3.0+fbm3(sp*2.0+so)*2.2; float d=1.0-abs(gnoise(vec3(sp.x*3.0,f*3.5,sp.z*3.0)+so)*2.0); return d*0.5+fbm3(sp*8.0+so)*0.2; }
  if (look==3) { float f=fbm3(sp*3.0+so); float r=abs(gnoise(sp*4.5+so+3.0)+gnoise(sp*9.0+so)*0.4); return f*0.5-(1.0-smoothstep(0.0,0.07,r))*0.4; }
  if (look==4) { float f=fbm3(sp*3.0+so); return f*0.3-(1.0-smoothstep(0.0,0.05,abs(gnoise(sp*5.5+so+9.0))))*0.3; }
  if (look==5) { float f=fbm3(sp*3.4+so); vec2 v=vor(sp*7.0+so); return f*0.4+(1.0-smoothstep(0.2,0.28,v.x))*0.5; }
  if (look==6) { vec2 v=vor(sp*5.0+so); return (1.0-smoothstep(0.0,0.35,v.x))*0.4; }
  return 0.0;
}

void atmosphereOf(int look, out vec3 atm, out float k){
  atm = vec3(0.4,0.6,1.0); k = 0.4;
  if (look==0) { atm=vec3(0.7,0.75,0.9); k=0.12; }
  else if (look==1) { atm=vec3(0.30,0.55,1.0); k=1.0; }
  else if (look==2) { atm=vec3(1.0,0.62,0.32); k=0.55; }
  else if (look==3) { atm=vec3(1.0,0.35,0.1); k=0.8; }
  else if (look==4) { atm=vec3(0.6,0.85,1.0); k=0.9; }
  else if (look==5) { atm=vec3(0.4,1.0,0.4); k=0.9; }
  else if (look==6) { atm=vec3(1.0,0.5,0.8); k=1.1; }
  else { atm=vec3(1.0,0.75,0.5); k=0.7; }
}

struct Surf { vec3 alb; float gloss; float bump; vec3 emisDay; vec3 emisNight; vec3 atm; float atmK; };

Surf surfaceOf(int look, vec3 sp, float seed, float t){
  Surf s; s.alb=vec3(0.5); s.gloss=0.05; s.bump=0.0; s.emisDay=vec3(0.0); s.emisNight=vec3(0.0); s.atm=vec3(0.4,0.6,1.0); s.atmK=0.4;
  vec3 so = vec3(seed*1.7, seed*0.37, seed*2.9);
  if (look==0) { // moon
    float f = fbm3(sp*2.4+so);
    float c = crater(vor(sp*2.2+so))*0.55 + crater(vor(sp*5.0+so*1.3))*0.35 + crater(vor(sp*11.0+so*0.7))*0.2*gHi;
    vec3 a = mix(vec3(0.36,0.35,0.38), vec3(0.80,0.78,0.75), clamp(f*1.25-0.1,0.0,1.0));
    a *= 1.0 + c*0.5;
    s.alb = hueMix(a, seed, 0.2); s.bump=0.9; s.atm=vec3(0.7,0.75,0.9); s.atmK=0.12; s.gloss=0.04;
  } else if (look==1) { // earth
    float h = fbm3(sp*1.8+so)*1.2-0.1;
    float land = smoothstep(0.50,0.53,h);
    float lat = abs(sp.y);
    vec3 oc = mix(vec3(0.01,0.07,0.24), vec3(0.04,0.32,0.58), smoothstep(0.2,0.52,h));
    vec3 forest = mix(vec3(0.09,0.28,0.10), vec3(0.32,0.44,0.16), fbm3(sp*6.0+so));
    float dry = smoothstep(0.35,0.7,fbm3(sp*3.0+so+9.0))*(1.0-lat);
    vec3 lc = mix(forest, vec3(0.66,0.54,0.31), dry);
    lc = mix(lc, vec3(0.45,0.40,0.36), smoothstep(0.62,0.8,h));
    float snow = smoothstep(0.72,0.86, lat + (h-0.5)*0.4 + fbm3(sp*5.0+so)*0.1);
    vec3 a = mix(oc, lc, land);
    a = mix(a, vec3(0.93,0.96,1.0), snow);
    float cl = smoothstep(0.5,0.78, fbm3(sp*2.8+vec3(t*0.01,0.0,0.0)+so+7.0)*1.2-0.05);
    a = mix(a, vec3(1.0), cl*0.9);
    s.gloss = 0.75*(1.0-land)*(1.0-snow)*(1.0-cl);
    s.bump = land*0.9*(1.0-cl);
    float city = step(0.58, fbm3(sp*14.0+so)*1.1)*land*(1.0-cl)*(1.0-snow)*gHi;
    s.emisNight = vec3(1.0,0.7,0.36)*city*1.8;
    s.alb=a; s.atm=vec3(0.30,0.55,1.0); s.atmK=1.0;
  } else if (look==2) { // desert
    float f=sp.y*3.0+fbm3(sp*2.0+so)*2.2;
    float d=1.0-abs(gnoise(vec3(sp.x*3.0,f*3.5,sp.z*3.0)+so)*2.0);
    vec3 a = mix(vec3(0.88,0.56,0.28), vec3(0.58,0.28,0.13), smoothstep(0.2,0.9,0.5+0.5*sin(f*2.4)));
    a = mix(a, vec3(0.96,0.78,0.52), d*0.3);
    a *= mix(1.0, 0.85+0.3*fbm3(sp*14.0+so), gHi);
    s.alb=hueMix(a, seed, 0.2); s.bump=0.95; s.atm=vec3(1.0,0.62,0.32); s.atmK=0.55; s.gloss=0.06;
  } else if (look==3) { // lava
    float f=fbm3(sp*3.0+so);
    float r=abs(gnoise(sp*4.5+so+3.0)+gnoise(sp*9.0+so)*0.4);
    float crack=1.0-smoothstep(0.0,0.07,r);
    float pulse = 0.75+0.25*sin(t*1.4+fbm3(sp*3.0)*12.0);
    s.alb = mix(vec3(0.04,0.025,0.025), vec3(0.22,0.12,0.09), f);
    s.emisDay = mix(vec3(1.0,0.22,0.03), vec3(1.0,0.85,0.3), crack*crack)*crack*2.4*pulse;
    s.bump=1.0; s.atm=vec3(1.0,0.35,0.1); s.atmK=0.8; s.gloss=0.1;
  } else if (look==4) { // ice
    float f=fbm3(sp*3.0+so);
    float crack=1.0-smoothstep(0.0,0.05,abs(gnoise(sp*5.5+so+9.0)));
    float crack2=1.0-smoothstep(0.0,0.04,abs(gnoise(sp*11.0+so+2.0)));
    vec3 a = mix(vec3(0.62,0.80,0.95), vec3(0.90,0.96,1.0), f);
    a = mix(a, vec3(0.30,0.58,0.9), (crack+crack2*0.5*gHi)*0.6);
    s.alb=a; s.gloss=0.9; s.bump=0.7; s.emisDay=vec3(0.1,0.28,0.5)*0.12; s.atm=vec3(0.6,0.85,1.0); s.atmK=0.9;
  } else if (look==5) { // goo
    float f=fbm3(sp*3.4+so+vec3(0.0,t*0.05,0.0));
    vec2 v=vor(sp*7.0+so);
    float bub=(1.0-smoothstep(0.2,0.28,v.x))*step(0.5,fract(v.y*13.7))*gHi;
    vec3 a = mix(vec3(0.10,0.48,0.14), vec3(0.45,0.92,0.22), f);
    a = mix(a, vec3(0.04,0.28,0.08), bub*0.6);
    s.alb=a; s.gloss=1.0; s.bump=1.1; s.emisDay=vec3(0.1,0.42,0.05)*0.3*f; s.atm=vec3(0.4,1.0,0.4); s.atmK=0.9;
  } else if (look==6) { // jelly
    float f=fbm3(sp*2.4+so+vec3(t*0.04));
    vec2 v=vor(sp*5.0+so);
    float cell=smoothstep(0.0,0.35,v.x);
    vec3 a = mix(vec3(0.95,0.22,0.52), vec3(1.0,0.62,0.82), f);
    a = mix(a*1.15, a*0.8, cell*0.5);
    s.alb=a; s.gloss=1.0; s.bump=0.9; s.emisDay=vec3(0.85,0.12,0.38)*0.3; s.atm=vec3(1.0,0.5,0.8); s.atmK=1.1;
  } else { // gas giant
    float w = fbm3(vec3(sp.x*2.0, sp.y*6.0, sp.z*2.0)+so+vec3(t*0.02,0.0,0.0));
    float f = sp.y*5.5 + w*2.4;
    vec2 sc = vec2(sp.x-0.35, (sp.y-0.22)*2.4);
    float sd = length(sc);
    f += exp(-sd*sd*14.0)*2.6*sin(atan(sc.y,sc.x)*2.0 - sd*9.0 + t*0.3);
    float band = 0.5+0.5*sin(f*2.8);
    vec3 cream = vec3(0.93,0.82,0.66), tan_ = vec3(0.80,0.54,0.34), rust = vec3(0.56,0.31,0.23);
    vec3 a = mix(mix(cream, tan_, band), rust, smoothstep(0.65,1.0,0.5+0.5*sin(f*1.1+1.0)));
    a = mix(a, vec3(0.9,0.5,0.35), exp(-sd*sd*30.0)*0.6);
    s.alb = hueMix(a, seed, 0.9); s.atm=vec3(1.0,0.75,0.5); s.atmK=0.7; s.gloss=0.08;
  }
  return s;
}

vec4 planet(){
  float R = vA.w, d = length(vP);
  float Rpx = R*uCam.z;
  gDetail = clamp(log2(max(Rpx,1.0)/9.0)+1.0, 1.0, uDetail);
  gHi = smoothstep(26.0, 64.0, Rpx);
  int look = int(vB.z+0.5);
  float atmo = vB.w;
  float aa = aaw();
  vec3 L;
  if (uSun.z > 0.5) { vec2 dd = uSun.xy - vA.xy; L = normalize(vec3(dd/max(length(dd),1.0), 0.45)); }
  else L = normalize(uLight);
  vec2 L2 = normalize(L.xy+1e-4);
  vec3 atm0; float atmK0;
  atmosphereOf(look, atm0, atmK0);
  vec4 col = vec4(0.0);
  // atmosphere / halo outside the disc
  float halo = max(atmo, R*0.2);
  if (d > R-aa) {
    float k = clamp(1.0-(d-R)/halo, 0.0, 1.0);
    float strength = (atmo>0.0 ? 0.8 : 0.3)*atmK0;
    float a = pow(k, atmo>0.0 ? 2.4 : 3.6) * strength;
    float lit = clamp(dot(normalize(vP+1e-4), L2)*0.5+0.62, 0.12, 1.0);
    col = vec4(atm0*a*lit*1.3, a*lit*0.85);
  }
  if (d < R+aa) {
    vec2 q = vP/R;
    float z = sqrt(max(0.0, 1.0-dot(q,q)));
    vec3 n = normalize(vec3(q, z+1e-4));
    float ang = uTime*0.03*(0.5+fract(vB.y*3.7)) + vB.y;
    vec3 sp = spin(n, ang);
    Surf s = surfaceOf(look, sp, vB.y, uTime);
    vec3 N = n;
    s.bump *= smoothstep(14.0, 44.0, Rpx);
    if (s.bump > 0.0 && uDetail > 2.0) {
      vec3 t1 = normalize(cross(n, vec3(0.0,1.0,0.001)));
      vec3 t2 = cross(n, t1);
      float e = 0.012;
      float h0 = heightOf(look, sp, vB.y);
      float h1 = heightOf(look, spin(n+t1*e, ang), vB.y);
      float h2 = heightOf(look, spin(n+t2*e, ang), vB.y);
      N = normalize(n - s.bump*0.34*((h1-h0)/e*t1 + (h2-h0)/e*t2));
    }
    float ndl = dot(N, L);
    float gdl = dot(n, L);
    float diff = clamp((ndl+0.14)/1.14, 0.0, 1.0);
    diff = diff*diff*(3.0-2.0*diff);
    float terminator = exp(-sq(gdl*3.2));
    vec3 ambient = s.atm*0.05 + vec3(0.010,0.014,0.028);
    vec3 lit = s.alb*(ambient + diff*vec3(1.0,0.97,0.92)*1.18);
    lit += s.atm*terminator*0.16*s.atmK*(0.4+diff);
    vec3 H = normalize(L+vec3(0.0,0.0,1.0));
    float nh = max(dot(N,H),0.0);
    float spec = pow(nh, mix(24.0,140.0,s.gloss))*s.gloss*diff*1.7;
    float nv = clamp(n.z, 0.0, 1.0);
    float fres = pow(1.0-nv, 3.2);
    lit += vec3(1.0,0.98,0.95)*spec + vec3(0.9,0.95,1.0)*s.gloss*fres*0.25*diff;
    lit += s.atm*fres*(0.15+0.95*clamp(gdl*0.6+0.5,0.0,1.0))*s.atmK*1.1;
    lit += s.emisDay;
    lit += s.emisNight*sq(1.0-diff);
    lit *= mix(0.72, 1.0, pow(nv, 0.35));
    float edge = 1.0-smoothstep(R-aa, R+aa, d);
    col = mix(col, vec4(lit,1.0), edge);
  }
  return col;
}

vec4 sun(){
  float R = vA.w, d = length(vP);
  float a = atan(vP.y, vP.x);
  float dn = d/R;
  float ray = fbm2(vec2(cos(a)*2.2, sin(a)*2.2) + uTime*0.12 + vB.y);
  float ray2 = fbm2(vec2(a*3.0, uTime*0.2+vB.y));
  float glow = exp(-max(dn-1.0,0.0)*2.4) * (0.5+1.1*ray) * (1.0-smoothstep(3.2,4.5,dn));
  glow += exp(-max(dn-1.0,0.0)*1.7)*0.25*(1.0-smoothstep(3.0,4.5,dn));
  float spikes = pow(max(ray2,0.0), 3.0)*exp(-max(dn-1.0,0.0)*1.5)*0.9*(1.0-smoothstep(3.0,4.5,dn));
  vec3 gc = mix(vec3(1.0,0.28,0.04), vec3(1.0,0.78,0.32), exp(-max(dn-1.0,0.0)*2.8));
  vec4 col = vec4(gc*(glow+spikes)*1.4, clamp(glow*0.8,0.0,1.0));
  if (dn < 1.0) {
    vec2 q = vP/R; float z = sqrt(max(0.0,1.0-dot(q,q)));
    vec3 n = vec3(q,z);
    float g = fbm3(vec3(q*3.4, uTime*0.1+vB.y));
    float g2 = fbm3(vec3(q*8.0, uTime*0.18+vB.y*2.0));
    float spots = smoothstep(0.62,0.7,fbm3(vec3(q*2.0,vB.y)));
    vec3 c = mix(vec3(1.0,0.32,0.04), vec3(1.0,0.9,0.5), clamp(g*1.3+g2*0.35,0.0,1.0));
    c = mix(c, vec3(0.5,0.1,0.02), spots*0.6);
    c *= 0.5+0.95*pow(z,0.6);   // limb darkening
    c *= 1.7;
    float edge = 1.0-smoothstep(1.0-aaw()/R, 1.0+aaw()/R, dn);
    col = mix(col, vec4(c,1.0), edge);
  }
  return col;
}

vec4 blackhole(){
  float R = vA.w, d = length(vP), dn = d/R;
  float tilt = vB.y*1.3;
  vec2 pr = vec2(cos(tilt)*vP.x + sin(tilt)*vP.y, -sin(tilt)*vP.x + cos(tilt)*vP.y);
  vec2 pe = vec2(pr.x, pr.y/0.34);          // disc seen at a grazing angle
  float de = length(pe)/R;
  float a = atan(pe.y, pe.x);
  vec4 col = vec4(0.0);
  float swirl = a - 2.2/max(de,0.5) + uTime*0.9;
  float dens = 0.45+0.85*fbm2(vec2(cos(swirl)*1.7, sin(swirl)*1.7)+vec2(de*1.6, 0.0));
  float disc = smoothstep(1.35,1.9,de)*(1.0-smoothstep(2.6,4.4,de));
  float doppler = 0.65+0.55*sin(a+0.6);
  vec3 hot = mix(vec3(1.0,0.85,0.55), vec3(0.95,0.25,0.55), smoothstep(1.4,3.6,de));
  float front = step(0.0, pr.y) ;                   // lower half passes in front of the hole
  col.rgb = hot*dens*disc*doppler*1.15; col.a = disc*0.95;
  // light bent over the top of the hole
  float arc = exp(-sq((dn-1.45)*4.2))*(1.0-smoothstep(-0.9,0.1,pr.y/R))*0.9;
  col.rgb += vec3(1.0,0.7,0.45)*arc*0.85; col.a = max(col.a, arc*0.8);
  float ph = exp(-sq((dn-1.06)*11.0));
  col.rgb += vec3(1.0,0.92,0.8)*ph*0.95; col.a = max(col.a, ph);
  float glow = exp(-max(dn-1.0,0.0)*1.4)*0.22;
  col.rgb += vec3(0.6,0.3,1.0)*glow; col.a = max(col.a, glow*0.6);
  float edge = 1.0-smoothstep(1.0-aaw()/R, 1.0+aaw()/R, dn);
  float hide = (1.0-front)*0.0;
  col = mix(col, vec4(0.0,0.0,0.0,1.0), edge);
  return col;
}

vec4 repulsor(){
  float R = vA.w, d = length(vP), dn = d/R;
  vec3 c1 = vec3(0.18,0.85,1.0);
  float ring = pow(0.5+0.5*sin((dn*3.0 - uTime*2.2)*3.1416), 6.0);
  float fall = clamp(1.0-(dn-1.0)/2.6, 0.0, 1.0);
  float a = ring*fall*fall*0.6*step(1.0, dn);
  float aura = exp(-max(dn-1.0,0.0)*2.2)*0.5;
  vec4 col = vec4(c1*(a*1.6+aura), max(a, aura*0.7));
  if (dn < 1.0) {
    vec2 q = vP/R; float z = sqrt(max(0.0,1.0-dot(q,q)));
    vec3 n = vec3(q,z);
    vec3 sp = vec3(q*1.0, z)*3.0 + vec3(0.0,0.0,uTime*0.25);
    vec2 v = vor(sp+vB.y);
    float cell = 1.0-smoothstep(0.0,0.14,v.x-0.18);
    float edgeLines = exp(-sq((v.x-0.38)/0.05));
    vec3 base = mix(vec3(0.03,0.12,0.30), vec3(0.06,0.4,0.7), fbm3(sp*0.8)*1.2);
    vec3 L = normalize(uLight);
    vec3 c = base*(0.5+0.9*max(dot(n,L),0.0));
    c += c1*edgeLines*1.3*pow(z,0.5);
    c += pow(max(dot(n, normalize(L+vec3(0,0,1))),0.0), 40.0)*0.9;
    c += c1*pow(1.0-z,2.2)*1.6;
    c += vec3(0.6,1.0,1.0)*exp(-dn*dn*14.0)*0.8;
    float edge = 1.0-smoothstep(1.0-aaw()/R, 1.0+aaw()/R, dn);
    col = mix(col, vec4(c,1.0), edge);
  }
  return col;
}

vec4 wormhole(){
  float R = vA.w, d = length(vP), dn = d/R;
  float a = atan(vP.y, vP.x);
  vec3 tint = vC.rgb;
  float tunnel = 0.5+0.5*sin(a*3.0 + 9.0/(dn+0.25) - uTime*3.2);
  float mask = 1.0-smoothstep(0.92, 1.0, dn);
  vec3 c = mix(tint*0.08, tint*1.4, tunnel*smoothstep(0.08,0.95,dn));
  c = mix(c, vec3(0.0), 1.0-smoothstep(0.0,0.4,dn));
  float rim = exp(-sq((dn-0.95)*9.0));
  c += tint*rim*1.25 + vec3(rim*0.25);
  float glow = exp(-max(dn-1.0,0.0)*2.2)*0.85*(1.0-smoothstep(2.4,3.6,dn));
  vec4 col = vec4(tint*glow*1.2, glow*0.7);
  return mix(col, vec4(c,1.0), mask);
}

vec4 holeCup(){
  float R = vA.w, d = length(vP);
  float aa = aaw();
  float pulse = fract(uTime*0.7+vB.z);
  float pr = R*(1.1+pulse*2.6);
  float pa = (1.0-pulse)*(1.0-pulse)*0.9*exp(-sq((d-pr)/(R*0.18)));
  vec3 gold = vec3(1.0,0.82,0.35);
  vec4 col = vec4(gold*pa*1.3, pa);
  float glow = exp(-max(d-R,0.0)/(R*0.5))*0.7;
  col += vec4(gold*glow*1.2, glow*0.6);
  if (d < R+aa) {
    float inner = smoothstep(0.0, R, d);
    vec3 pit = mix(vec3(0.0,0.0,0.015), vec3(0.04,0.03,0.07), inner*inner);
    pit += vec3(0.5,0.35,0.15)*pow(inner,5.0)*0.4;
    float rim = exp(-sq((d-R*0.88)/(R*0.1)));
    vec3 c = pit + gold*rim*2.2;
    float edge = 1.0-smoothstep(R-aa, R+aa, d);
    col = mix(col, vec4(c,1.0), edge);
  }
  return col;
}

vec4 flag(){
  vec2 dir = vB.zw;
  vec2 perp = vec2(-dir.y, dir.x);
  float u = dot(vP, dir), v = dot(vP, perp);
  float L = vA.w;
  float aa = aaw();
  float pole = (1.0-smoothstep(0.9-aa, 0.9+aa, abs(v))) * smoothstep(-aa,aa,u) * (1.0-smoothstep(L-aa,L+aa,u));
  float H = L*0.38, W = L*0.46;
  float mid = L - H*0.5;
  float w = W*(1.0 - abs((u-mid)/(H*0.5)));
  float vv = v - sin(uTime*3.2 + v*0.18)*1.6*clamp(v/W,0.0,1.0);
  float inside = smoothstep(-aa*1.5,aa*1.5, vv) * (1.0-smoothstep(-aa*1.5,aa*1.5, vv - w)) * step(L-H, u) * step(u, L) * step(0.0,w);
  vec3 pen = mix(vec3(1.0,0.28,0.38), vec3(1.0,0.55,0.35), clamp(vv/W,0.0,1.0));
  vec3 c = vec3(0.0); float a = 0.0;
  c = mix(c, vec3(0.92,0.94,1.0), pole); a = max(a, pole);
  c = mix(c, pen*1.15, inside); a = max(a, inside);
  float tip = exp(-sq(length(vec2(u-L, v))/(1.6)))*0.0;
  return vec4(c*a, a);
}

vec4 starPickup(){
  float R = vA.w;
  float pulse = 1.0+0.1*sin(uTime*3.0+vB.y);
  vec2 p = vec2(vP.x, -vP.y)/(R*pulse);
  float d = sdStar5(p, 0.92, 0.46);
  float aa = aaw()/(R*pulse);
  float fill = 1.0-smoothstep(-aa, aa, d);
  float glow = exp(-max(d,0.0)*2.6)*0.8;
  vec3 c = mix(vec3(1.0,0.62,0.12), vec3(1.0,0.97,0.7), clamp(0.55-0.5*p.y - length(p)*0.3 ,0.0,1.0));
  c += vec3(1.0,0.9,0.5)*exp(-length(p)*3.0)*0.5;
  float sparkle = exp(-abs(p.x)*18.0)*exp(-abs(p.y)*1.6)*0.6 + exp(-abs(p.y)*18.0)*exp(-abs(p.x)*1.6)*0.6;
  sparkle *= 0.5+0.5*sin(uTime*2.4+vB.y*3.0);
  vec4 col = vec4(vec3(1.0,0.78,0.25)*(glow+sparkle*0.8)*1.2, glow*0.7);
  col = mix(col, vec4(c*1.25,1.0), fill);
  return col * vC.a;
}

vec4 ball(){
  float R = vA.w, d = length(vP);
  float aa = aaw();
  float glow = exp(-max(d-R,0.0)/(R*1.4))*0.7*(1.0-smoothstep(R*2.2, R*3.9, d));
  vec4 col = vec4(vec3(0.65,0.85,1.0)*glow*1.1, glow*0.5);
  if (d < R+aa) {
    vec2 q = vP/R; float z = sqrt(max(0.0,1.0-dot(q,q)));
    vec3 n = vec3(q,z);
    vec3 L = normalize(uLight);
    float diff = max(dot(n,L),0.0);
    vec3 c = vec3(0.96,0.98,1.0)*(0.38+0.75*diff);
    c += vec3(0.5,0.7,1.0)*pow(1.0-z,2.5)*0.45;
    c += pow(max(dot(n, normalize(L+vec3(0,0,1))),0.0), 28.0)*1.4;
    // dimples
    vec2 v = vor(vec3(q*3.2, z*3.2));
    c *= 0.93+0.07*smoothstep(0.1,0.4,v.x);
    float edge = 1.0-smoothstep(R-aa, R+aa, d);
    col = mix(col, vec4(c,1.0), edge);
  }
  return col*vC.a;
}

vec4 windZone(){
  float R = vA.w, d = length(vP);
  vec2 dir = normalize(vB.zw + 1e-5);
  vec2 perp = vec2(-dir.y, dir.x);
  float sp = length(vB.zw);
  float u = dot(vP, dir), v = dot(vP, perp);
  float mask = 1.0-smoothstep(R*0.82, R, d);
  float lane = floor(v*0.045);
  float lr = hash21(vec2(lane, vB.y));
  float pos = fract(u*0.0035 - uTime*sp*0.0035*(0.6+lr*0.8) + lr*5.0);
  float streak = smoothstep(0.0,0.5,pos)*(1.0-smoothstep(0.5,1.0,pos));
  float lw = 1.0-smoothstep(0.0,0.5,abs(fract(v*0.045)-0.5)*2.0);
  float line = streak*lw*step(0.45, lr);
  float edge = exp(-sq((d-R*0.97)/2.5))*0.55;
  float fill = mask*0.07;
  vec3 c = vec3(0.55,0.82,1.0);
  float a = line*mask*0.55 + fill + edge;
  return vec4(c*a*1.2, a);
}

vec4 sparkle(){
  vec2 p = vP/vA.w;
  float d = length(p);
  float a = exp(-d*5.0)*0.9 + exp(-abs(p.x)*22.0)*exp(-abs(p.y)*2.2) + exp(-abs(p.y)*22.0)*exp(-abs(p.x)*2.2);
  return vec4(vC.rgb*a*vC.a, 0.0);
}

vec4 dot_(){
  float d = length(vP)/vA.w;
  float hard = vB.z;
  float a = mix(pow(clamp(1.0-d,0.0,1.0), 2.2), 1.0-smoothstep(1.0-aaw()/vA.w*1.5, 1.0, d), hard);
  return vec4(vC.rgb*a*vC.a, 0.0);
}

vec4 ring(){
  float d = length(vP);
  float w = vB.z;
  float a = exp(-sq((d-vA.w)/max(w,0.5)));
  return vec4(vC.rgb*a*vC.a, 0.0);
}

vec4 capsule(){
  vec2 h = vB.zw;
  float d = sdSeg(vP, -h, h);
  float w = vA.w;
  float dash = 1.0;
  if (vB.y > 0.5) {
    float t = dot(vP, h/max(length(h),1e-4));
    dash = smoothstep(0.35,0.55, abs(fract(t/vB.y - uTime*0.8)-0.5)*2.0);
  }
  float a = (1.0-smoothstep(w-aaw(), w+aaw(), d))*dash;
  float g = exp(-d/(w*2.6))*0.45*dash*(1.0-smoothstep(w*7.0, w*12.0, d));
  return vec4(vC.rgb*(a+g)*vC.a, 0.0);
}

void main(){
  int type = int(vB.x+0.5);
  gDetail = uDetail;
  vec4 c;
  if (type==0) c = planet();
  else if (type==1) c = sun();
  else if (type==2) c = blackhole();
  else if (type==3) c = repulsor();
  else if (type==4) c = wormhole();
  else if (type==5) c = holeCup();
  else if (type==6) c = dot_();
  else if (type==7) c = starPickup();
  else if (type==8) c = ball();
  else if (type==9) c = windZone();
  else if (type==10) c = ring();
  else if (type==11) c = sparkle();
  else if (type==12) c = capsule();
  else if (type==13) c = flag();
  else c = vec4(1.0,0.0,1.0,1.0);
  o = c;
}`;

// ---------------------------------------------------------------------------
// Fullscreen passes
// ---------------------------------------------------------------------------

export const FS_VS = /* glsl */ `#version 300 es
out vec2 vUv;
void main(){
  vec2 p = vec2((gl_VertexID<<1)&2, gl_VertexID&2);
  vUv = p;
  gl_Position = vec4(p*2.0-1.0, 0.0, 1.0);
}`;

export const BG_FS = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUv;
uniform vec2 uRes;
uniform vec3 uCam;
uniform float uTime;
uniform vec2 uPar;
uniform vec3 uCol1;
uniform vec3 uCol2;
uniform float uSeed;
uniform vec2 uBounds;
uniform bool uStarsOnly;
out vec4 o;
${NOISE}
// one layer of stars: sparse, mostly dim, a few bright with soft halos
vec3 starLayer(vec2 uv, float scale, float seed, float size){
  vec2 g = uv*scale; vec2 id = floor(g); vec2 f = fract(g)-0.5;
  float h = hash21(id+seed);
  vec2 off = (hash22(id+seed+3.1)-0.5)*0.7;
  float d = length(f-off);
  float bright = pow(h, 14.0)*3.2 + 0.05;
  float tw = 0.8+0.2*sin(uTime*(0.6+h*2.4)+h*40.0);
  float core = (1.0-smoothstep(0.0, size, d));
  float halo = exp(-d*d/(size*size*9.0))*0.28*bright;
  vec3 tint = mix(vec3(0.62,0.76,1.0), vec3(1.0,0.82,0.62), hash21(id+seed+9.7));
  tint = mix(tint, vec3(1.0), 0.4);
  float present = step(0.78, h);
  return tint*(core*bright + halo)*tw*present;
}
void main(){
  vec2 px = vUv*uRes;
  vec2 world = (px - uRes*0.5)/uCam.z + uCam.xy;
  vec2 uv = world*0.0008;
  vec3 c = vec3(0.006,0.008,0.022);
  if (!uStarsOnly) {
    float t = uTime*0.004;
    vec2 q = vec2(fbm2(uv*1.3+uSeed+vec2(t,0.0)+uPar*0.03), fbm2(uv*1.3+vec2(5.2,1.3)-uSeed-vec2(0.0,t)+uPar*0.03));
    float r = fbm2(uv*1.5 + 2.4*q + uPar*0.05);
    c += mix(uCol1, uCol2, q.x) * smoothstep(0.32,0.95,r) * 0.85;
    c += uCol1 * pow(q.y, 3.0) * 0.55;
    c += uCol2 * pow(fbm2(uv*2.6 - uSeed*0.7 + 3.0*q), 3.2) * 0.6;
    // dust lanes
    float dust = fbm2(uv*3.6 + q*2.0 + 11.0);
    c *= 1.0 - smoothstep(0.52,0.78,dust)*0.55;
    // soft galactic band
    float band = exp(-sq((uv.y*1.1 + uv.x*0.5 + 0.08*sin(uSeed))/0.3));
    c += mix(uCol1,uCol2,0.5)*band*0.07*fbm2(uv*6.0+uSeed);
  }
  vec2 sq = world*0.01;
  vec3 st = vec3(0.0);
  st += starLayer(sq + uPar*0.003, 6.0, 1.0, 0.07);
  st += starLayer(sq*1.8 + uPar*0.006 + 3.0, 11.0, 5.0, 0.06)*0.8;
  st += starLayer(sq*3.1 + uPar*0.011 + 9.0, 19.0, 9.0, 0.05)*0.6;
  c += st;
  if (uBounds.x > 0.0) {
    vec2 a = abs(world) - uBounds;
    float outside = smoothstep(0.0, 90.0, max(a.x, a.y));
    c *= 1.0 - 0.5*outside;
    float inner = exp(-max(-max(a.x,a.y),0.0)/70.0)*0.035;
    c += vec3(0.25,0.45,0.9)*inner*step(max(a.x,a.y), 0.0);
  }
  o = vec4(c, 1.0);
}`;

export const FIELD_FS = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUv;
uniform vec2 uRes;
uniform vec3 uCam;
uniform float uTime;
uniform int uMode;
uniform int uCount;
uniform vec4 uBodies[16]; // x, y, mu, eps2
uniform float uAlpha;
out vec4 o;
void main(){
  vec2 px = vUv*uRes;
  vec2 p = (px - uRes*0.5)/uCam.z + uCam.xy;
  if (uMode == 1) {
    float phi = 0.0;
    for (int i=0;i<16;i++){
      if (i>=uCount) break;
      vec2 d = uBodies[i].xy - p;
      phi += uBodies[i].z / sqrt(dot(d,d)+uBodies[i].w+25.0);
    }
    float s = sign(phi);
    float l = log(1.0+abs(phi)*0.02)*4.2;
    float f = fract(l);
    float aa = fwidth(l)*1.5;
    float line = 1.0 - smoothstep(0.0, aa, min(f, 1.0-f)*1.0);
    float fade = 0.15 + 0.85*clamp(abs(phi)*0.0015, 0.0, 1.0);
    vec3 c = s>0.0 ? vec3(0.25,0.55,1.0) : vec3(1.0,0.35,0.4);
    float a = line*fade*0.55*uAlpha;
    o = vec4(c*a, 0.0);
  } else {
    vec2 q = p;
    for (int i=0;i<16;i++){
      if (i>=uCount) break;
      vec2 d = uBodies[i].xy - p;
      float r2 = dot(d,d)+uBodies[i].w+400.0;
      q += d * clamp(uBodies[i].z*0.55/(r2*1.0), -0.9, 0.9);
    }
    vec2 g = q/42.0;
    vec2 f = abs(fract(g-0.5)-0.5)/fwidth(g);
    float line = 1.0 - min(min(f.x,f.y), 1.0);
    float a = line*0.32*uAlpha;
    o = vec4(vec3(0.3,0.65,1.0)*a, 0.0);
  }
}`;



export const BRIGHT_FS = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uTex;
uniform vec2 uTexel;
out vec4 o;
void main(){
  vec3 c = texture(uTex, vUv+uTexel*vec2(-0.5,-0.5)).rgb + texture(uTex, vUv+uTexel*vec2(0.5,-0.5)).rgb
         + texture(uTex, vUv+uTexel*vec2(-0.5,0.5)).rgb + texture(uTex, vUv+uTexel*vec2(0.5,0.5)).rgb;
  c *= 0.25;
  float br = max(c.r, max(c.g, c.b));
  float knee = 0.35;
  float soft = clamp(br - 0.62 + knee, 0.0, 2.0*knee);
  soft = soft*soft/(4.0*knee+1e-4);
  float contrib = max(soft, br-0.62)/max(br,1e-4);
  o = vec4(c*contrib, 1.0);
}`;

export const COPY_FS = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uTex;
out vec4 o;
void main(){ o = vec4(texture(uTex, vUv).rgb, 1.0); }`;

export const BLUR_FS = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uTex;
uniform vec2 uDir; // texel step
out vec4 o;
void main(){
  vec3 s = texture(uTex, vUv).rgb*0.2270270270;
  s += (texture(uTex, vUv+uDir*1.3846153846).rgb + texture(uTex, vUv-uDir*1.3846153846).rgb)*0.3162162162;
  s += (texture(uTex, vUv+uDir*3.2307692308).rgb + texture(uTex, vUv-uDir*3.2307692308).rgb)*0.0702702703;
  o = vec4(s, 1.0);
}`;

export const COMPOSITE_FS = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uScene;
uniform sampler2D uB0;
uniform sampler2D uB1;
uniform sampler2D uB2;
uniform sampler2D uB3;
uniform sampler2D uB4;
uniform vec2 uRes;
uniform vec3 uHoles[4]; // pixel x, pixel y (top-left origin), radius px
uniform int uHoleCount;
uniform float uBloomAmt;
uniform int uBloomLevels;
uniform vec2 uShake;
uniform float uTime;
out vec4 o;
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*.1031); p3 += dot(p3, p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
void main(){
  vec2 px = vUv*uRes;
  vec2 pxTL = vec2(px.x, uRes.y-px.y);
  vec2 uv = vUv;
  for (int i=0;i<4;i++){
    if (i>=uHoleCount) break;
    vec2 d = pxTL - uHoles[i].xy;
    float r = uHoles[i].z;
    float dist = length(d)+1e-3;
    float k = (r*r*3.6)/(dist*dist+r*r*0.35);
    k = min(k, dist*0.88);
    vec2 dirTL = d/dist;
    uv -= vec2(dirTL.x, -dirTL.y)*k/uRes * (1.0 - smoothstep(r*4.0, r*10.0, dist));
  }
  uv += uShake/uRes;
  vec2 c = vUv-0.5;
  vec2 off = c*dot(c,c)*0.0035;
  vec3 col;
  col.r = texture(uScene, uv-off).r;
  col.g = texture(uScene, uv).g;
  col.b = texture(uScene, uv+off).b;
  if (uBloomAmt > 0.0) {
    vec3 bl = texture(uB0, uv).rgb*0.42 + texture(uB1, uv).rgb*0.5 + texture(uB2, uv).rgb*0.55;
    if (uBloomLevels > 3) bl += texture(uB3, uv).rgb*0.5 + texture(uB4, uv).rgb*0.42;
    col += bl*uBloomAmt;
  }
  // filmic shoulder: linear below 0.8, smooth roll-off above, highlights bleed to white
  col = max(col, 0.0);
  vec3 hi = 0.8 + 0.2*tanh((col-0.8)/0.2);
  col = mix(col, hi, step(0.8, col));
  float mx = max(col.r, max(col.g, col.b));
  float lum = dot(col, vec3(0.2126,0.7152,0.0722));
  col = mix(col, vec3(lum), smoothstep(0.82,1.0,mx)*0.3);
  // gentle grade: a touch of contrast and saturation
  col = mix(col, col*col*(3.0-2.0*col), 0.14);
  col = mix(vec3(lum), col, 1.1);
  // vignette + grain
  col *= 1.0 - dot(c,c)*0.7;
  col += (hash12(gl_FragCoord.xy + fract(uTime)*91.7)-0.5)*0.018;
  o = vec4(col, 1.0);
}`;

// ---------------------------------------------------------------------------
// UI: instanced quads in CSS-pixel space
// ---------------------------------------------------------------------------

export const UI_VS = /* glsl */ `#version 300 es
layout(location=0) in vec2 aCorner; // 0..1
layout(location=1) in vec4 aRect;   // x, y, w, h
layout(location=2) in vec4 aCol;
layout(location=3) in vec4 aCol2;
layout(location=4) in vec4 aPar;    // type, radius, border, extra
layout(location=5) in vec4 aUv;
uniform vec2 uView; // css pixels
out vec2 vLocal;   // pixels from rect centre
out vec2 vUv;
out vec2 vN;       // 0..1
flat out vec4 vRect;
flat out vec4 vCol;
flat out vec4 vCol2;
flat out vec4 vPar;
void main(){
  vec2 pos = aRect.xy + aCorner*aRect.zw;
  vec2 ndc = pos/uView*2.0-1.0; ndc.y = -ndc.y;
  gl_Position = vec4(ndc,0.0,1.0);
  vLocal = (aCorner-0.5)*aRect.zw;
  vN = aCorner;
  vUv = mix(aUv.xy, aUv.zw, aCorner);
  vRect = aRect; vCol = aCol; vCol2 = aCol2; vPar = aPar;
}`;

export const UI_FS = /* glsl */ `#version 300 es
precision highp float;
in vec2 vLocal;
in vec2 vUv;
in vec2 vN;
flat in vec4 vRect;
flat in vec4 vCol;
flat in vec4 vCol2;
flat in vec4 vPar;
uniform sampler2D uAtlas;
uniform sampler2D uGlass;
uniform vec2 uDevRes;
uniform float uTime;
uniform float uPx; // css px per device px
out vec4 o;
${NOISE}

float sdBox(vec2 p, vec2 b, float r){ vec2 q = abs(p)-b+r; return length(max(q,0.0))+min(max(q.x,q.y),0.0)-r; }
float sdCircle(vec2 p, float r){ return length(p)-r; }
float sdRing(vec2 p, float r, float w){ return abs(length(p)-r)-w; }
float cov(float d, float aa){ return 1.0-smoothstep(-aa, aa, d); }
float sdTri(vec2 p, float r){ // triangle pointing right
  const float k = 1.7320508;
  p.x = abs(p.x) - r; p.y = p.y + r/k;
  if (p.x + k*p.y > 0.0) p = vec2(p.x - k*p.y, -k*p.x - p.y)/2.0;
  p.x -= clamp(p.x, -2.0*r, 0.0);
  return -length(p)*sign(p.y);
}
float triR(vec2 p, float r){ return sdTri(vec2(-p.y, p.x), r); }
float triU(vec2 p, float r){ return sdTri(vec2(p.x, -p.y), r); }
vec2 rot(vec2 p, float a){ float c=cos(a), s=sin(a); return vec2(c*p.x - s*p.y, s*p.x + c*p.y); }
float sdArc(vec2 p, float r, float w, float a0, float a1){
  float a = atan(p.y,p.x);
  float m = a0 + mod(a - a0, 6.2831853);
  float inside = step(m, a1);
  float dist = abs(length(p)-r)-w;
  vec2 e0 = r*vec2(cos(a0),sin(a0)), e1 = r*vec2(cos(a1),sin(a1));
  float de = min(length(p-e0), length(p-e1))-w;
  return mix(de, dist, inside);
}
// arrow head triangle at point c pointing in direction angle
float sdHead(vec2 p, vec2 c, float ang, float s){ return sdTri(rot(p-c, -ang)/s, 1.0)*s; }

float icon(int id, vec2 p, float aa){
  // p in -1..1
  float d = 1e3;
  if (id==1) { // retry: circular arrow
    d = sdArc(p, 0.52, 0.14, 0.6, 5.5);
    d = min(d, sdHead(p, 0.52*vec2(cos(0.6), sin(0.6))+vec2(0.0,0.0), 0.6+1.5708+0.0, 0.34));
  } else if (id==2) { // undo
    d = sdArc(p+vec2(0.0,-0.12), 0.46, 0.14, -2.9, 0.2);
    d = min(d, sdHead(p, vec2(-0.46,-0.12-0.02), -1.2, 0.34));
    d = min(d, sdHead(p, vec2(-0.5,0.0), 2.5, 0.001));
  } else if (id==3) { // menu bars
    d = min(min(sdBox(p+vec2(0.0,0.5), vec2(0.62,0.1), 0.1), sdBox(p, vec2(0.62,0.1), 0.1)), sdBox(p-vec2(0.0,0.5), vec2(0.62,0.1), 0.1));
  } else if (id==4) { // home
    d = sdBox(p-vec2(0.0,0.3), vec2(0.4,0.32), 0.05);
    d = min(d, triU((p-vec2(0.0,-0.16))/1.0, 0.62));
    d = max(d, -sdBox(p-vec2(0.0,0.46), vec2(0.1,0.16), 0.02));
  } else if (id==5) { // play
    d = triR((p+vec2(0.06,0.0))*1.25, 0.62)/1.25;
  } else if (id==6) { // fast forward
    d = min(triR((p-vec2(-0.32,0.0))*1.7, 0.62)/1.7, triR((p-vec2(0.26,0.0))*1.7, 0.62)/1.7);
  } else if (id==7) { // gravity field (concentric rings w/ dot)
    d = min(sdRing(p, 0.72, 0.07), min(sdRing(p, 0.42, 0.07), sdCircle(p, 0.14)));
  } else if (id==8) { // sound on
    d = sdBox(p+vec2(0.3,0.0), vec2(0.14,0.2), 0.03);
    d = min(d, sdTri(rot(p+vec2(0.0,0.0), 3.1416)*1.0-vec2(-0.02,0.0), 0.44)*1.0);
    d = min(d, sdArc(p-vec2(0.1,0.0), 0.4, 0.07, -0.8, 0.8));
    d = min(d, sdArc(p-vec2(0.1,0.0), 0.68, 0.07, -0.8, 0.8));
  } else if (id==9) { // sound off
    d = sdBox(p+vec2(0.3,0.0), vec2(0.14,0.2), 0.03);
    d = min(d, sdTri(rot(p, 3.1416)-vec2(-0.0,0.0), 0.44));
    d = min(d, sdSeg(p, vec2(0.15,-0.3), vec2(0.7,0.3))-0.08);
    d = min(d, sdSeg(p, vec2(0.15,0.3), vec2(0.7,-0.3))-0.08);
  } else if (id==10) { // plus
    d = min(sdBox(p, vec2(0.62,0.1), 0.1), sdBox(p, vec2(0.1,0.62), 0.1));
  } else if (id==11) { // minus
    d = sdBox(p, vec2(0.62,0.1), 0.1);
  } else if (id==12) { // check
    d = min(sdSeg(p, vec2(-0.55,0.05), vec2(-0.2,0.45)), sdSeg(p, vec2(-0.2,0.45), vec2(0.6,-0.45))) - 0.11;
  } else if (id==13) { // star
    d = sdStar5(vec2(p.x,-p.y)*1.05, 0.95, 0.42);
  } else if (id==14) { // left chevron
    d = min(sdSeg(p, vec2(0.3,-0.55), vec2(-0.3,0.0)), sdSeg(p, vec2(-0.3,0.0), vec2(0.3,0.55))) - 0.11;
  } else if (id==15) { // right chevron
    d = min(sdSeg(p, vec2(-0.3,-0.55), vec2(0.3,0.0)), sdSeg(p, vec2(0.3,0.0), vec2(-0.3,0.55))) - 0.11;
  } else if (id==16) { // cross
    d = min(sdSeg(p, vec2(-0.5,-0.5), vec2(0.5,0.5)), sdSeg(p, vec2(-0.5,0.5), vec2(0.5,-0.5))) - 0.11;
  } else if (id==17) { // trash
    d = sdBox(p-vec2(0.0,0.2), vec2(0.38,0.46), 0.08);
    d = max(d, -sdBox(p-vec2(0.0,0.22), vec2(0.3,0.38), 0.04)*1.0 + 0.0);
    d = min(d, sdBox(p-vec2(0.0,-0.42), vec2(0.58,0.08), 0.06));
    d = min(d, sdBox(p-vec2(0.0,-0.56), vec2(0.18,0.08), 0.04));
  } else if (id==18) { // copy / share
    d = sdBox(p-vec2(0.14,0.14), vec2(0.4,0.46), 0.08);
    d = max(d, -sdBox(p-vec2(0.14,0.14), vec2(0.3,0.36), 0.04));
    d = min(d, sdBox(p+vec2(0.16,0.16), vec2(0.4,0.46), 0.08)*1.0);
    d = max(d, -(sdBox(p+vec2(0.16,0.16), vec2(0.3,0.36), 0.04))*(step(0.0, -sdBox(p+vec2(0.16,0.16), vec2(0.3,0.36), 0.04))));
  } else if (id==19) { // dice
    d = sdBox(p, vec2(0.62), 0.2);
    d = max(d, -min(min(sdCircle(p-vec2(-0.3,-0.3),0.1), sdCircle(p,0.1)), min(sdCircle(p-vec2(0.3,0.3),0.1), min(sdCircle(p-vec2(0.3,-0.3),0.1), sdCircle(p-vec2(-0.3,0.3),0.1)))));
  } else if (id==20) { // lock
    d = sdBox(p-vec2(0.0,0.22), vec2(0.5,0.4), 0.08);
    d = min(d, max(sdRing(p-vec2(0.0,-0.18), 0.32, 0.09), p.y-(-0.1)-0.0));
  } else if (id==21) { // pencil
    d = sdSeg(p, vec2(-0.5,0.5), vec2(0.4,-0.4)) - 0.14;
    d = min(d, sdTri(rot(p-vec2(-0.52,0.52), 2.356)*1.6, 0.5)/1.6);
  } else if (id==22) { // flag
    d = min(sdSeg(p, vec2(-0.4,-0.7), vec2(-0.4,0.7))-0.08, triR((p-vec2(0.12,-0.36))*1.6, 0.55)/1.6);
  } else if (id==23) { // pause
    d = min(sdBox(p-vec2(-0.28,0.0), vec2(0.14,0.5), 0.06), sdBox(p-vec2(0.28,0.0), vec2(0.14,0.5), 0.06));
  } else if (id==24) { // bulb / hint
    d = min(sdCircle(p-vec2(0.0,-0.12),0.42), sdBox(p-vec2(0.0,0.52), vec2(0.2,0.1), 0.05));
  } else if (id==25) { // ghost / eye
    d = max(sdCircle(p*vec2(1.0,1.5),0.8), -sdCircle(p, 0.2));
  } else if (id==26) { // keyboard backspace
    d = min(sdBox(p-vec2(0.15,0.0), vec2(0.5,0.4), 0.06), sdTri(rot(p+vec2(0.28,0.0), 3.1416)*1.0, 0.44));
    d = max(d, -min(sdSeg(p-vec2(0.15,0.0), vec2(-0.2,-0.2), vec2(0.2,0.2))-0.06, sdSeg(p-vec2(0.15,0.0), vec2(-0.2,0.2), vec2(0.2,-0.2))-0.06));
  }
  return d;
}


void main(){
  int type = int(vPar.x+0.5);
  float aa = uPx;
  vec4 col = vec4(0.0);
  if (type==0) { // rounded rect, flat or vertical gradient
    float d = sdBox(vLocal, vRect.zw*0.5, vPar.y);
    float cvg = cov(d, aa);
    vec4 base = vPar.w > 0.5 ? mix(vCol, vCol2, vN.y) : vCol;
    col = vec4(base.rgb*base.a*cvg, base.a*cvg);
  } else if (type==6) { // rounded rect outline, diagonal gradient (light from top-left)
    float d = sdBox(vLocal, vRect.zw*0.5, vPar.y);
    float cvg = cov(abs(d + vPar.z*0.5) - vPar.z*0.5, aa);
    vec4 c = mix(vCol, vCol2, clamp(vN.y*0.85+vN.x*0.25, 0.0, 1.0));
    col = vec4(c.rgb*c.a*cvg, c.a*cvg);
  } else if (type==7) { // soft drop shadow (rect is expanded by pad = vPar.w)
    float d = sdBox(vLocal, vRect.zw*0.5 - vPar.w, vPar.y);
    float a = (1.0 - smoothstep(-vPar.z, vPar.z, d));
    a *= a;
    col = vec4(vCol.rgb*vCol.a*a, vCol.a*a);
  } else if (type==8) { // frosted glass: blurred scene + tint + sheen
    float d = sdBox(vLocal, vRect.zw*0.5, vPar.y);
    float cvg = cov(d, aa);
    vec2 guv = gl_FragCoord.xy/uDevRes;
    vec3 g = texture(uGlass, guv).rgb;
    g = g*1.12 + 0.012;
    vec3 rgb = mix(g, vCol.rgb, vCol.a);
    rgb += vec3(1.0)*(1.0-smoothstep(0.0, 0.7, vN.y))*vPar.w;                   // top sheen
    rgb += vCol2.rgb*vCol2.a*(1.0-smoothstep(0.0, 1.0, length(vN-vec2(0.5,0.0))*1.1)); // coloured glow from the top edge
    rgb += (hash21(gl_FragCoord.xy)-0.5)*0.012;
    col = vec4(rgb*cvg, cvg);
  } else if (type==9) { // mini shaded sphere (level thumbnails, icons)
    float r = vRect.z*0.5*(vPar.w > 0.0 ? vPar.w : 1.0);
    float d = length(vLocal);
    vec2 q = vLocal/r;
    float z = sqrt(max(0.0, 1.0-dot(q,q)));
    vec3 n = vec3(q, z);
    vec3 L = normalize(vec3(-0.55,-0.6,0.62));
    float diff = max(dot(n,L),0.0);
    vec3 c = vCol.rgb*(0.22+0.95*diff);
    c += pow(max(dot(n, normalize(L+vec3(0,0,1))),0.0), 30.0)*0.35;
    c += vCol.rgb*pow(1.0-z, 3.0)*0.5;
    float cvg = cov(d-r, aa);
    float halo = exp(-max(d-r,0.0)/(r*0.45))*0.35*vPar.y;
    vec3 rgb = c*cvg + vCol.rgb*halo*(1.0-cvg);
    col = vec4(rgb*vCol.a, max(cvg, halo*0.6)*vCol.a);
  } else if (type==1) { // glyph
    float a = texture(uAtlas, vUv).a;
    vec4 c = mix(vCol, vCol2, vN.y);
    col = vec4(c.rgb*c.a*a, c.a*a);
  } else if (type==2) { // icon
    float h = min(vRect.z, vRect.w)*0.5;
    vec2 p = vLocal/h;
    float d = icon(int(vPar.y+0.5), p, aa/h)*h;
    float cvg = cov(d, aa);
    col = vec4(vCol.rgb*vCol.a*cvg, vCol.a*cvg);
  } else if (type==3) { // soft glow
    float d = length(vLocal/(vRect.zw*0.5));
    float a = pow(clamp(1.0-d,0.0,1.0), vPar.y);
    col = vec4(vCol.rgb*vCol.a*a, vCol.a*a);
  } else if (type==5) { // filled disc with ring
    float r = vRect.z*0.5;
    float d = length(vLocal)-r;
    float cvg = cov(d, aa);
    vec4 c = vCol;
    float bw = vPar.z;
    if (bw>0.0) c = mix(vCol2, vCol, cov(d+bw, aa));
    col = vec4(c.rgb*c.a*cvg, c.a*cvg);
  }
  o = col;
}`;
