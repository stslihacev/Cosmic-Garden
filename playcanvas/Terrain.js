const seed=42;

function hash(x,y,z){
 const v=Math.sin(x*127.1+y*311.7+z*74.7+seed)*43758.5453;
 return v-Math.floor(v);
}

function fade(v){return v*v*v*(v*(v*6-15)+10);}

function noise(x,y,z){
 const X=Math.floor(x),Y=Math.floor(y),Z=Math.floor(z);
 const u=fade(x-X),v=fade(y-Y),w=fade(z-Z);
 const n=(i,j,k)=>hash(X+i,Y+j,Z+k);
 const a=n(0,0,0)+(n(1,0,0)-n(0,0,0))*u;
 const c=n(0,1,0)+(n(1,1,0)-n(0,1,0))*u;
 const e=n(0,0,1)+(n(1,0,1)-n(0,0,1))*u;
 const g=n(0,1,1)+(n(1,1,1)-n(0,1,1))*u;
 const xy=a+(c-a)*v;
 const yz=e+(g-e)*v;
 return xy+(yz-xy)*w;
}

export function fbm(x,y,z,n=5){
 let value=0,amp=1,freq=1,total=0;
 for(let i=0;i<n;i++){
  value+=noise(x*freq,y*freq,z*freq)*amp;
  total+=amp;
  amp*=.5;
  freq*=2;
 }
 return value/total;
}

export function ridged(x,y,z,n=5){
 let value=0,amp=.5,freq=1,total=0;
 for(let i=0;i<n;i++){
  value+=(1-Math.abs(noise(x*freq,y*freq,z*freq)*2-1))*amp;
  total+=amp;
  amp*=.5;
  freq*=2.03;
 }
 return value/total;
}

function clamp(v,a,b){return Math.max(a,Math.min(b,v));}

function smooth(a,b,v){
 const t=clamp((v-a)/(b-a),0,1);
 return t*t*(3-2*t);
}

function mix(a,b,t){return a+(b-a)*t;}

export function terrainAt(d){
 const {x,y,z}=d;

 // Macro scale: keep the continents recognizable while adding much more
 // information at every subsequent scale.
 const continental=
   fbm(x*1.20+7,y*1.20-3,z*1.20+11,7)*.70+
   fbm(x*2.45-9,y*2.45+4,z*2.45+2,6)*.30;

 // More octaves and higher frequencies make the surface hold visible detail
 // instead of collapsing into broad blurry patches.
 const regional=fbm(x*4.8-12,y*4.8+8,z*4.8+5,6);
 const terrain=fbm(x*12+17,y*12-11,z*12+3,6);
 const detail=fbm(x*30-4,y*30+9,z*30+16,5);
 const micro=fbm(x*72+13,y*72-5,z*72+21,4);
 const grain=fbm(x*145-19,y*145+23,z*145-7,3);
 const mountain=ridged(x*3.6+21,y*3.6-7,z*3.6+13,7);
 const mountainDetail=ridged(x*12+31,y*12-17,z*12+9,5);

 const land=smooth(.405,.555,continental);
 const inland=smooth(.49,.68,continental);
 const coast=smooth(.43,.60,continental);

 const elevation=
   regional*.36+
   terrain*.31+
   detail*.18+
   micro*.10+
   grain*.05;

 const mountainField=
   mountain*.72+
   mountainDetail*.28+
   regional*.16+
   terrain*.08;

 const mountainMask=smooth(.48,.75,mountainField)*inland;
 const e=clamp((elevation-.30)/.70,0,1);

 if(land<.5){
  return {
   isLand:false,land,elevation,detail,mountainMask:0,
   landElevation:0,height:1
  };
 }

 // Stronger but still continuous relief. Fine grain is intentionally tiny so
 // it adds surface complexity without turning the planet into a lumpy ball.
 const height=
   1.002+
   coast*.010+
   e*.032+
   Math.pow(mountainMask,1.55)*.090+
   micro*.004+
   grain*.0015;

 return {
  isLand:true,
  land,
  elevation,
  detail,
  micro,
  grain,
  mountainMask,
  landElevation:e,
  height
 };
}

export function terrainColor(t){
 if(!t.isLand) return [.010,.060,.145,1];

 const e=t.landElevation;
 const m=t.mountainMask;
 const d=t.detail;
 const micro=t.micro ?? .5;
 const grain=t.grain ?? .5;

 // Richer natural palette: lowlands, temperate terrain, dry/high terrain,
 // mountain rock and snow are separated by elevation and relief.
 let r=.16,g=.38,b=.105;

 let k=smooth(.05,.20,e);
 r=mix(r,.22,k); g=mix(g,.48,k); b=mix(b,.13,k);

 k=smooth(.16,.38,e);
 r=mix(r,.34,k); g=mix(g,.50,k); b=mix(b,.16,k);

 k=smooth(.32,.55,e);
 r=mix(r,.50,k); g=mix(g,.43,k); b=mix(b,.19,k);

 k=smooth(.48,.72,e);
 r=mix(r,.63,k); g=mix(g,.49,k); b=mix(b,.27,k);

 k=smooth(.50,.78,m);
 r=mix(r,.36,k); g=mix(g,.36,k); b=mix(b,.30,k);

 k=smooth(.72,1,m+e*.22);
 r=mix(r,.80,k); g=mix(g,.82,k); b=mix(b,.84,k);

 // High-frequency albedo breakup. This is deliberately subtle: the eye sees
 // richer terrain rather than noisy static.
 const variation=
   .82+
   (d-.5)*.42+
   (micro-.5)*.16+
   (grain-.5)*.08;

 return [
  clamp(r*variation,0,1),
  clamp(g*variation,0,1),
  clamp(b*variation,0,1),
  1
 ];
}
