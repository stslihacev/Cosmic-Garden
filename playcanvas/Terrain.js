const seed=42;
function hash(x,y,z){const v=Math.sin(x*127.1+y*311.7+z*74.7+seed)*43758.5453;return v-Math.floor(v);}
function fade(v){return v*v*v*(v*(v*6-15)+10);}
function noise(x,y,z){
 const X=Math.floor(x),Y=Math.floor(y),Z=Math.floor(z),u=fade(x-X),v=fade(y-Y),w=fade(z-Z);
 const n=(i,j,k)=>hash(X+i,Y+j,Z+k);
 const a=n(0,0,0)+(n(1,0,0)-n(0,0,0))*u,c=n(0,1,0)+(n(1,1,0)-n(0,1,0))*u;
 const e=n(0,0,1)+(n(1,0,1)-n(0,0,1))*u,g=n(0,1,1)+(n(1,1,1)-n(0,1,1))*u;
 return a+(c-a)*v+((e+(g-e)*v)-(a+(c-a)*v))*w;
}
export function fbm(x,y,z,n=5){let v=0,a=1,f=1,total=0;for(let i=0;i<n;i++){v+=noise(x*f,y*f,z*f)*a;total+=a;a*=.5;f*=2;}return v/total;}
export function ridged(x,y,z,n=5){let v=0,a=.5,f=1,total=0;for(let i=0;i<n;i++){v+=(1-Math.abs(noise(x*f,y*f,z*f)*2-1))*a;total+=a;a*=.5;f*=2.03;}return v/total;}
function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
function smooth(a,b,v){const t=clamp((v-a)/(b-a),0,1);return t*t*(3-2*t);}
export function terrainAt(d){
 const {x,y,z}=d;
 const continent=fbm(x*1.45+7,y*1.45-3,z*1.45+11,6)*.75+fbm(x*2.9-9,y*2.9+4,z*2.9+2,4)*.25;
 const region=fbm(x*4.2-12,y*4.2+8,z*4.2+5,5);
 const detail=fbm(x*15+17,y*15-11,z*15+3,4);
 const micro=fbm(x*38-4,y*38+9,z*38+16,3);
 const mountain=ridged(x*3.2+21,y*3.2-7,z*3.2+13,5);
 const land=smooth(.43,.58,continent);
 const inland=smooth(.48,.72,continent);
 const relief=region*.62+detail*.23+micro*.15;
 if(land<.5)return {isLand:false,land,elevation:relief,detail,mountainMask:0,landElevation:0,height:1};
 const coast=smooth(.48,.62,land);
 const mountainMask=smooth(.53,.78,mountain*.72+region*.18+detail*.10)*inland;
 const e=clamp((relief-.34)/.66,0,1);
 const height=1.003+coast*.012+e*.038+Math.pow(mountainMask,1.7)*.12+micro*.006;
 return {isLand:true,land,elevation:relief,detail,mountainMask,landElevation:e,height};
}
export function terrainColor(t){
 if(!t.isLand)return [.008,.075,.16,1];
 const e=t.landElevation,m=t.mountainMask;
 let r=.16,g=.34,b=.16;
 const mix=(a,b,k)=>a+(b-a)*k;
 let k=smooth(.05,.28,e);r=mix(r,.30,k);g=mix(g,.48,k);b=mix(b,.20,k);
 k=smooth(.25,.52,e);r=mix(r,.52,k);g=mix(g,.43,k);b=mix(b,.22,k);
 k=smooth(.48,.75,e);r=mix(r,.40,k);g=mix(g,.39,k);b=mix(b,.36,k);
 k=smooth(.72,1,m+e*.22);r=mix(r,.82,k);g=mix(g,.84,k);b=mix(b,.86,k);
 const v=.88+(t.detail-.5)*.24;
 return [clamp(r*v,0,1),clamp(g*v,0,1),clamp(b*v,0,1),1];
}