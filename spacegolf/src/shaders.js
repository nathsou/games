// All GLSL lives here. Everything is procedural: no textures are loaded
// (the only texture is the glyph atlas rasterised at startup).

const NOISE = /* glsl */ `
float hash21(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
float hash31(vec3 p){ p = fract(p*0.1031); p += dot(p, p.zyx+31.32); return fract((p.x+p.y)*p.z); }
float noise2(vec2 x){
  vec2 i=floor(x), f=fract(x); f=f*f*(3.0-2.0*f);
  return mix(mix(hash21(i),hash21(i+vec2(1,0)),f.x), mix(hash21(i+vec2(0,1)),hash21(i+vec2(1,1)),f.x), f.y);
}
float noise3(vec3 x){
  vec3 i=floor(x), f=fract(x); f=f*f*(3.0-2.0*f);
  return mix(
    mix(mix(hash31(i),hash31(i+vec3(1,0,0)),f.x), mix(hash31(i+vec3(0,1,0)),hash31(i+vec3(1,1,0)),f.x), f.y),
    mix(mix(hash31(i+vec3(0,0,1)),hash31(i+vec3(1,0,1)),f.x), mix(hash31(i+vec3(0,1,1)),hash31(i+vec3(1,1,1)),f.x), f.y), f.z);
}
float fbm2(vec2 p){ float a=0.5,s=0.0; for(int i=0;i<5;i++){ s+=a*noise2(p); p=p*2.02+vec2(5.3,1.7); a*=0.5; } return s; }
float fbm3(vec3 p){ float a=0.5,s=0.0; for(int i=0;i<5;i++){ s+=a*noise3(p); p=p*2.03+vec3(1.7,9.2,3.1); a*=0.5; } return s; }
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
float sdSeg(vec2 p, vec2 a, vec2 b){ vec2 pa=p-a, ba=b-a; float h=clamp(dot(pa,ba)/dot(ba,ba),0.0,1.0); return length(pa-ba*h); }
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
out vec4 o;
${NOISE}

float aaw(){ return 1.0/uCam.z; }

vec3 hueMix(vec3 c, float seed, float amt){ return mix(c, c.gbr, fract(seed*7.31)*amt); }

// returns surface colour; gloss/emission through out params
vec3 surface(int look, vec3 sp, float seed, out float gloss, out float emis, out vec3 atm){
  gloss = 0.05; emis = 0.0; atm = vec3(0.4,0.6,1.0);
  vec3 so = vec3(seed*1.7, seed*0.37, seed*2.9);
  if (look==0) { // moon
    float h = fbm3(sp*2.8+so);
    vec3 c = mix(vec3(0.42,0.42,0.46), vec3(0.78,0.77,0.78), h);
    float cr = smoothstep(0.56,0.62,noise3(sp*7.0+so));
    float rim = smoothstep(0.62,0.66,noise3(sp*7.0+so)) - smoothstep(0.66,0.72,noise3(sp*7.0+so));
    c *= 1.0-0.4*cr; c += 0.12*rim;
    atm = vec3(0.7,0.75,0.9);
    return hueMix(c, seed, 0.25);
  } else if (look==1) { // earth
    float h = fbm3(sp*2.0+so);
    float land = smoothstep(0.50,0.53,h);
    vec3 ocean = mix(vec3(0.03,0.14,0.42), vec3(0.08,0.42,0.78), h*1.7);
    vec3 lc = mix(vec3(0.16,0.5,0.18), vec3(0.58,0.46,0.3), smoothstep(0.56,0.76,h));
    vec3 c = mix(ocean, lc, land);
    gloss = 0.55*(1.0-land);
    float cap = smoothstep(0.82, 0.9, abs(sp.y) + 0.08*fbm3(sp*4.0+so));
    c = mix(c, vec3(0.95), cap);
    float cl = smoothstep(0.52,0.78,fbm3(sp*3.0+vec3(uTime*0.02,0.0,0.0)+so+7.0));
    c = mix(c, vec3(1.0), cl*0.85);
    atm = vec3(0.35,0.6,1.0);
    return c;
  } else if (look==2) { // desert
    float f = sp.y*4.0 + fbm3(sp*3.0+so)*2.4;
    vec3 c = mix(vec3(0.88,0.58,0.28), vec3(0.62,0.3,0.14), smoothstep(0.2,0.8,0.5+0.5*sin(f*2.2)));
    c = mix(c, vec3(0.95,0.78,0.5), 0.35*fbm3(sp*6.0+so));
    atm = vec3(1.0,0.65,0.35);
    return hueMix(c, seed, 0.2);
  } else if (look==3) { // lava
    float f = fbm3(sp*3.2+so);
    vec3 c = mix(vec3(0.1,0.05,0.04), vec3(0.28,0.14,0.1), f);
    float crack = 1.0 - smoothstep(0.0, 0.06, abs(fbm3(sp*4.5+so+3.0)-0.5));
    emis = crack;
    c = mix(c, vec3(1.0,0.45,0.08), crack);
    atm = vec3(1.0,0.4,0.15);
    return c;
  } else if (look==4) { // ice
    float f = fbm3(sp*3.0+so);
    vec3 c = mix(vec3(0.72,0.88,0.98), vec3(0.48,0.72,0.92), f);
    float crack = 1.0 - smoothstep(0.0, 0.035, abs(fbm3(sp*5.0+so+9.0)-0.5));
    c = mix(c, vec3(0.95,1.0,1.0), crack*0.8);
    gloss = 0.7;
    atm = vec3(0.6,0.85,1.0);
    return c;
  } else if (look==5) { // goo
    float f = fbm3(sp*3.4+so+vec3(0.0,uTime*0.05,0.0));
    vec3 c = mix(vec3(0.16,0.62,0.18), vec3(0.55,0.95,0.25), f);
    float b = smoothstep(0.62,0.68,noise3(sp*8.0+so));
    c = mix(c, vec3(0.05,0.35,0.1), b*0.6);
    gloss = 0.85;
    atm = vec3(0.4,1.0,0.4);
    return c;
  } else if (look==6) { // jelly
    float f = fbm3(sp*2.4+so+vec3(uTime*0.04));
    vec3 c = mix(vec3(0.95,0.25,0.55), vec3(1.0,0.6,0.8), f);
    gloss = 0.95; emis = 0.15;
    atm = vec3(1.0,0.5,0.8);
    return c;
  }
  // gas giant
  float f = sp.y*5.5 + fbm3(vec3(sp.x*2.0, sp.y*7.0, sp.z*2.0)+so+vec3(uTime*0.03,0.0,0.0))*2.2;
  float s = 0.5+0.5*sin(f*2.6);
  vec3 c = mix(mix(vec3(0.92,0.8,0.62), vec3(0.78,0.5,0.3), s), vec3(0.5,0.3,0.25), smoothstep(0.7,1.0,0.5+0.5*sin(f*1.1+1.0)));
  atm = vec3(1.0,0.75,0.5);
  return hueMix(c, seed, 0.9);
}

vec4 planet(){
  float R = vA.w, d = length(vP);
  int look = int(vB.z+0.5);
  float atmo = vB.w;
  float aa = aaw();
  vec4 col = vec4(0.0);
  float tmp; float tmp2; vec3 atm;
  surface(look, vec3(0.3), vB.y, tmp, tmp2, atm);
  // halo / atmosphere
  float halo = max(atmo, R*0.14);
  if (d > R-aa) {
    float k = clamp(1.0-(d-R)/halo, 0.0, 1.0);
    float a = pow(k, atmo>0.0?2.2:3.4) * (atmo>0.0?0.55:0.28);
    col = vec4(atm*a, a*0.9);
  }
  if (d < R+aa) {
    vec2 q = vP/R;
    float z = sqrt(max(0.0, 1.0-dot(q,q)));
    vec3 n = normalize(vec3(q, z+1e-4));
    float ang = uTime*0.04*(0.5+fract(vB.y*3.7)) + vB.y;
    vec3 sp = vec3(n.x*cos(ang)+n.z*sin(ang), n.y, -n.x*sin(ang)+n.z*cos(ang));
    float gloss, emis; vec3 at2;
    vec3 base = surface(look, sp, vB.y, gloss, emis, at2);
    vec3 L = normalize(uLight);
    float ndl = dot(n, L);
    float diff = smoothstep(-0.25, 0.85, ndl);
    vec3 lit = base*(0.09 + 0.95*diff);
    lit = mix(lit, base*vec3(0.5,0.55,0.8)*0.25, (1.0-diff)*0.5); // blue-ish night side
    vec3 H = normalize(L+vec3(0.0,0.0,1.0));
    float spec = pow(max(dot(n,H),0.0), 36.0)*gloss;
    lit += spec*vec3(1.0);
    lit += emis*base*1.2;
    float fres = pow(1.0-z, 3.0);
    lit += at2*fres*(0.15+0.7*diff)*(atmo>0.0?1.2:0.5);
    float edge = 1.0-smoothstep(R-aa, R+aa, d);
    col = mix(col, vec4(lit,1.0), edge);
  }
  return col;
}

vec4 sun(){
  float R = vA.w, d = length(vP);
  float a = atan(vP.y, vP.x);
  float dn = d/R;
  vec4 col = vec4(0.0);
  float ray = fbm3(vec3(cos(a)*2.5, sin(a)*2.5, uTime*0.25+vB.y));
  float glow = exp(-max(dn-1.0,0.0)*2.2) * (0.55+0.9*ray);
  vec3 gc = mix(vec3(1.0,0.35,0.05), vec3(1.0,0.8,0.3), exp(-max(dn-1.0,0.0)*3.0));
  col = vec4(gc*glow*0.9, glow*0.8);
  if (dn < 1.0) {
    vec2 q = vP/R; float z = sqrt(max(0.0,1.0-dot(q,q)));
    float g = fbm3(vec3(q*3.2, uTime*0.12+vB.y));
    float g2 = fbm3(vec3(q*7.0, uTime*0.2+vB.y*2.0));
    vec3 c = mix(vec3(1.0,0.4,0.05), vec3(1.0,0.95,0.55), clamp(g*1.4+g2*0.3,0.0,1.0));
    c *= 0.55+0.6*z;
    float edge = 1.0-smoothstep(1.0-aaw()/R, 1.0+aaw()/R, dn);
    col = mix(col, vec4(c*1.15,1.0), edge);
  }
  return col;
}

vec4 blackhole(){
  float R = vA.w, d = length(vP), dn = d/R;
  float a = atan(vP.y, vP.x);
  vec4 col = vec4(0.0);
  float spin = a + 2.6/dn - uTime*1.1;
  float br = 0.35+0.9*fbm3(vec3(cos(spin)*1.6, sin(spin)*1.6, dn*1.8));
  float disk = smoothstep(1.15,1.45,dn)*(1.0-smoothstep(2.0,3.9,dn));
  vec3 hot = mix(vec3(1.0,0.9,0.7), vec3(0.8,0.25,1.0), smoothstep(1.3,3.2,dn));
  col.rgb = hot*br*disk*1.5; col.a = disk*0.95;
  float ph = exp(-pow((dn-1.1)*9.0, 2.0));
  col.rgb += vec3(1.0,0.85,0.7)*ph*1.2; col.a = max(col.a, ph);
  float edge = 1.0-smoothstep(1.0-aaw()/R, 1.0+aaw()/R, dn);
  col = mix(col, vec4(0.0,0.0,0.0,1.0), edge);
  float outer = exp(-max(dn-3.0,0.0)*1.6)*0.0;
  col.a = max(col.a, outer);
  return col;
}

vec4 repulsor(){
  float R = vA.w, d = length(vP), dn = d/R;
  vec3 c1 = vec3(0.2,0.85,1.0);
  vec4 col = vec4(0.0);
  float ring = pow(0.5+0.5*sin((dn*3.2 - uTime*2.4)*3.1416), 5.0);
  float fall = clamp(1.0-(dn-1.0)/2.6, 0.0, 1.0);
  float a = ring*fall*fall*0.55*step(1.0, dn);
  col = vec4(c1*a, a);
  if (dn < 1.0) {
    vec2 q = vP/R; float z = sqrt(max(0.0,1.0-dot(q,q)));
    vec3 n = vec3(q,z);
    float f = fbm3(vec3(q*2.5, uTime*0.3+vB.y));
    vec3 c = mix(vec3(0.1,0.25,0.6), vec3(0.15,0.95,1.0), f*1.2);
    vec3 L = normalize(uLight);
    c *= 0.5+0.7*max(dot(n,L),0.0);
    c += pow(max(dot(n, normalize(L+vec3(0,0,1))),0.0), 30.0);
    c += c1*pow(1.0-z,2.0)*0.9;
    float edge = 1.0-smoothstep(1.0-aaw()/R, 1.0+aaw()/R, dn);
    col = mix(col, vec4(c,1.0), edge);
  }
  return col;
}

vec4 wormhole(){
  float R = vA.w, d = length(vP), dn = d/R;
  float a = atan(vP.y, vP.x);
  vec3 tint = vC.rgb;
  float spiral = 0.5+0.5*sin(a*3.0 + dn*7.0 - uTime*3.5);
  float mask = 1.0-smoothstep(0.9, 1.0, dn);
  vec3 c = mix(tint*0.15, tint*1.25, spiral*smoothstep(0.1,0.9,dn));
  c = mix(c, vec3(0.0), (1.0-smoothstep(0.0,0.35,dn)));
  float rim = exp(-pow((dn-0.95)*9.0,2.0));
  c += tint*rim*1.5 + vec3(rim*0.4);
  float glow = exp(-max(dn-1.0,0.0)*2.5)*0.7;
  vec4 col = vec4(tint*glow, glow*0.6);
  return mix(col, vec4(c,1.0), mask);
}

vec4 holeCup(){
  // vA.w = cup radius; vB.z = pulse phase
  float R = vA.w, d = length(vP);
  float aa = aaw();
  vec4 col = vec4(0.0);
  float pulse = fract(uTime*0.8+vB.z);
  float pr = R*(1.0+pulse*2.2);
  float pa = (1.0-pulse)*0.7*exp(-pow((d-pr)/(R*0.22),2.0));
  col += vec4(vec3(1.0,0.9,0.4)*pa, pa);
  float glow = exp(-max(d-R,0.0)/(R*0.45))*0.55;
  col += vec4(vec3(1.0,0.8,0.3)*glow, glow*0.7);
  if (d < R+aa) {
    float rim = smoothstep(R*0.78, R*0.9, d);
    vec3 c = mix(vec3(0.0,0.0,0.02), vec3(1.0,0.92,0.55), rim);
    float edge = 1.0-smoothstep(R-aa, R+aa, d);
    col = mix(col, vec4(c,1.0), edge);
  }
  return col;
}

vec4 flag(){
  // pole direction in vB.zw (unit), pole length in vA.w
  vec2 dir = vB.zw;
  vec2 perp = vec2(-dir.y, dir.x);
  float u = dot(vP, dir), v = dot(vP, perp);
  float L = vA.w;
  float aa = aaw();
  float pole = (1.0-smoothstep(1.0-aa, 1.0+aa, abs(v))) * step(0.0,u) * step(u,L);
  float t = uTime*3.0;
  float k = clamp((u-(L-L*0.42))/(L*0.42), 0.0, 1.0);
  float wave = sin(t + u*0.5)*1.6*k;
  float fy = v - (L*0.2+wave*0.0);
  float w = (1.0-k)*L*0.3;
  float tri = step(L*0.58, u)*step(u, L)*step(0.0, v - wave*0.4)*step(v - wave*0.4, L*0.3*(1.0-(u-L*0.58)/(L*0.42)*0.9)*0.9+0.0);
  vec3 c = vec3(0.0);
  float a = 0.0;
  c = mix(c, vec3(0.9,0.9,0.95), pole); a = max(a, pole);
  c = mix(c, vec3(1.0,0.25,0.3), tri); a = max(a, tri);
  return vec4(c*a, a);
}

vec4 starPickup(){
  float R = vA.w;
  float s = 1.0+0.12*sin(uTime*3.0+vB.y);
  vec2 p = vec2(vP.x, -vP.y)/(R*s);
  float d = sdStar5(p, 0.95, 0.45);
  float aa = aaw()/(R*s);
  float fill = 1.0-smoothstep(-aa, aa, d);
  float glow = exp(-max(d,0.0)*3.0)*0.6;
  vec3 c = mix(vec3(1.0,0.78,0.15), vec3(1.0,0.97,0.7), 0.5-0.5*p.y);
  vec4 col = vec4(vec3(1.0,0.8,0.2)*glow, glow*0.7);
  return mix(col, vec4(c,1.0), fill) * vC.a;
}

vec4 ball(){
  float R = vA.w, d = length(vP);
  float aa = aaw();
  float glow = exp(-max(d-R,0.0)/(R*1.1))*0.5;
  vec4 col = vec4(vec3(0.7,0.85,1.0)*glow, glow*0.5);
  if (d < R+aa) {
    vec2 q = vP/R; float z = sqrt(max(0.0,1.0-dot(q,q)));
    vec3 n = vec3(q,z);
    vec3 L = normalize(uLight);
    float diff = max(dot(n,L),0.0);
    vec3 c = vec3(0.95,0.97,1.0)*(0.45+0.65*diff);
    c += pow(max(dot(n, normalize(L+vec3(0,0,1))),0.0), 20.0)*0.8;
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
  float mask = (1.0-smoothstep(R*0.9, R, d));
  float n = noise2(vec2(v*0.09, floor(u*0.01)));
  float streak = noise2(vec2(v*0.11+vB.y, u*0.012 - uTime*sp*0.012));
  streak = smoothstep(0.62, 0.9, streak);
  float edge = exp(-pow((d-R*0.97)/3.0, 2.0))*0.5;
  vec3 c = vec3(0.55,0.8,1.0);
  float a = (streak*0.35 + 0.05)*mask + edge*0.5;
  return vec4(c*a, a);
}

vec4 dot_(){
  float d = length(vP)/vA.w;
  float hard = vB.z;
  float a = mix(pow(clamp(1.0-d,0.0,1.0), 2.0), 1.0-smoothstep(1.0-aaw()/vA.w*1.5, 1.0, d), hard);
  return vec4(vC.rgb*a*vC.a, 0.0);
}

vec4 ring(){
  float d = length(vP);
  float w = vB.z;
  float a = exp(-pow((d-vA.w)/max(w,0.5), 2.0));
  return vec4(vC.rgb*a*vC.a, 0.0);
}

vec4 capsule(){
  vec2 h = vB.zw; // half vector
  float d = sdSeg(vP, -h, h);
  float w = vA.w;
  float dash = 1.0;
  if (vB.y > 0.5) {
    float t = dot(vP, normalize(h)) ;
    dash = smoothstep(0.35,0.55, abs(fract(t/vB.y - uTime*0.8)-0.5)*2.0);
  }
  float a = (1.0-smoothstep(w-aaw(), w+aaw(), d))*dash;
  float g = exp(-d/(w*3.0))*0.35*dash;
  return vec4(vC.rgb*(a+g)*vC.a, 0.0);
}

void main(){
  int type = int(vB.x+0.5);
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
out vec4 o;
${NOISE}
float starLayer(vec2 uv, float scale, float seed, float size){
  vec2 g = uv*scale; vec2 id = floor(g); vec2 f = fract(g)-0.5;
  float h = hash21(id+seed);
  vec2 off = vec2(hash21(id+seed+3.1), hash21(id+seed+7.7))-0.5;
  float d = length(f-off*0.7);
  float tw = 0.65+0.35*sin(uTime*(1.0+h*3.0)+h*40.0);
  float s = smoothstep(size*(0.4+h), 0.0, d) * step(0.84, h) * tw;
  return s;
}
void main(){
  vec2 px = vUv*uRes;
  vec2 world = (px - uRes*0.5)/uCam.z + uCam.xy;
  vec2 uv = world*0.0011;
  float n1 = fbm2(uv*1.4 + uSeed + uPar*0.05);
  float n2 = fbm2(uv*2.6 - uSeed*0.7 + vec2(4.0) + uPar*0.09);
  vec3 c = vec3(0.012,0.014,0.03);
  c += uCol1*pow(n1,2.6)*1.5;
  c += uCol2*pow(n2,3.2)*1.2;
  float band = exp(-pow((uv.y*1.1 + uv.x*0.45 + 0.1*sin(uSeed))/0.28, 2.0));
  c += mix(uCol1,uCol2,0.5)*band*0.1*fbm2(uv*5.0+uSeed);
  float st = 0.0;
  vec2 q = world*0.012;
  st += starLayer(q + uPar*0.004, 9.0, 1.0, 0.16)*1.0;
  st += starLayer(q*1.9 + uPar*0.008 + 3.0, 14.0, 5.0, 0.13)*0.8;
  st += starLayer(q*3.1 + uPar*0.014 + 9.0, 22.0, 9.0, 0.11)*0.6;
  c += vec3(0.85,0.9,1.0)*st;
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
out vec4 o;
void main(){
  vec3 c = texture(uTex, vUv).rgb;
  float l = max(c.r, max(c.g, c.b));
  float k = smoothstep(0.55, 1.0, l);
  o = vec4(c*k, 1.0);
}`;

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
uniform sampler2D uBloom;
uniform vec2 uRes;
uniform vec3 uHoles[4]; // pixel x, pixel y (top-left origin), radius px
uniform int uHoleCount;
uniform float uBloomAmt;
uniform float uFade;
uniform vec2 uShake;
out vec4 o;
void main(){
  vec2 px = vUv*uRes;
  vec2 pxTL = vec2(px.x, uRes.y-px.y);
  vec2 uv = vUv;
  for (int i=0;i<4;i++){
    if (i>=uHoleCount) break;
    vec2 d = pxTL - uHoles[i].xy;
    float r = uHoles[i].z;
    float dist = length(d)+1e-3;
    float k = (r*r*3.2)/(dist*dist+r*r*0.35);
    k = min(k, dist*0.85);
    vec2 dirTL = d/dist;
    uv -= vec2(dirTL.x, -dirTL.y)*k/uRes * (1.0 - smoothstep(r*4.0, r*9.0, dist));
  }
  uv += uShake/uRes;
  vec3 c = texture(uScene, uv).rgb;
  vec3 b = texture(uBloom, uv).rgb;
  c += b*uBloomAmt;
  vec2 v = vUv-0.5;
  c *= 1.0 - dot(v,v)*0.55;
  c *= uFade;
  o = vec4(c, 1.0);
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
  } else if (type==6) { // rounded rect outline
    float d = sdBox(vLocal, vRect.zw*0.5, vPar.y);
    float cvg = cov(abs(d + vPar.z*0.5) - vPar.z*0.5, aa);
    col = vec4(vCol.rgb*vCol.a*cvg, vCol.a*cvg);
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
  } else if (type==4) { // star dot field (title backdrop sparkle)
    float d = length(vLocal/(vRect.zw*0.5));
    float a = pow(clamp(1.0-d,0.0,1.0), 3.0);
    col = vec4(vCol.rgb*vCol.a*a, 0.0);
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
