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

 // Large-scale continental structure.
 const continental=
   fbm(x*1.20+7,y*1.20-3,z*1.20+11,6)*.70+
   fbm(x*2.45-9,y*2.45+4,z*2.45+2,5)*.30;

 // Separate scales: broad regions -> terrain -> fine surface.
 const regional=fbm(x*4.8-12,y*4.8+8,z*4.8+5,5);
 const terrain=fbm(x*11+17,y*11-11,z*11+3,5);
 const detail=fbm(x*27-4,y*27+9,z*27+16,4);
 const micro=fbm(x*62+13,y*62-5,z*62+21,3);
 const mountain=ridged(x*3.4+21,y*3.4-7,z*3.4+13,6);

 // Wider coast transition makes the silhouette smooth while retaining detail.
 const land=smooth(.405,.555,continental);
 const inland=smooth(.49,.68,continental);
 const coast=smooth(.43,.60,continental);

 const elevation=regional*.40+terrain*.34+detail*.18+micro*.08;
 const mountainMask=smooth(.50,.76,mountain*.70+regional*.20+terrain*.10)*inland;
 const e=clamp((elevation-.30)/.70,0,1);

 if(land<.5){
  return {
   isLand:false,land,elevation,detail,mountainMask:0,
   landElevation:0,height:1
  };
 }

 // Stronger relief, but still subtle enough to avoid a lumpy ball.
 const height=
   1.002+
   coast*.010+
   e*.028+
   Math.pow(mountainMask,1.65)*.075+
   micro*.003;

 return {
  isLand:true,
  land,
  elevation,
  detail,
  mountainMask,
  landElevation:e,
  height
 };
}

export function terrainColor(t){
 if(!t.isLand) return [.012,.075,.16,1];

 const e=t.landElevation;
 const m=t.mountainMask;
 const d=t.detail;

 // Earth-like biome palette with much stronger tonal separation.
 let r=.20,g=.42,b=.15;

 let k=smooth(.08,.25,e);
 r=mix(r,.28,k); g=mix(g,.50,k); b=mix(b,.18,k);

 k=smooth(.20,.43,e);
 r=mix(r,.48,k); g=mix(g,.45,k); b=mix(b,.20,k);

 k=smooth(.40,.64,e);
 r=mix(r,.62,k); g=mix(g,.52,k); b=mix(b,.27,k);

 k=smooth(.52,.78,m);
 r=mix(r,.38,k); g=mix(g,.39,k); b=mix(b,.30,k);

 k=smooth(.74,1,m+e*.20);
 r=mix(r,.82,k); g=mix(g,.84,k); b=mix(b,.86,k);

 // Fine natural variation; never desaturate the entire landmass.
 const variation=.84+(d-.5)*.34;
 return [
  clamp(r*variation,0,1),
  clamp(g*variation,0,1),
  clamp(b*variation,0,1),
  1
 ];
}
