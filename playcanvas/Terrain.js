const seed=42;
function hash(x,y,z){const v=Math.sin(x*127.1+y*311.7+z*74.7+seed)*43758.5453;return v-Math.floor(v);}
function fade(v){return v*v*v*(v*(v*6-15)+10);}
function noise(x,y,z){
 const X=Math.floor(x),Y=Math.floor(y),Z=Math.floor(z),u=fade(x-X),v=fade(y-Y),w=fade(z-Z);
 const a=hash(X,Y,Z),b=hash(X+1,Y,Z),c=hash(X,Y+1,Z),d=hash(X+1,Y+1,Z);
 const e=hash(X,Y,Z+1),f=hash(X+1,Y,Z+1),g=hash(X,Y+1,Z+1),h=hash(X+1,Y+1,Z+1);
 const x1=a+(b-a)*u,x2=c+(d-c)*u,x3=e+(f-e)*u,x4=g+(h-g)*u;
 return (x1+(x2-x1)*v)+((x3+(x4-x3)*v)-(x1+(x2-x1)*v))*w;
}
export function fbm(x,y,z,n=4){
 let value=0,amp=1,freq=1,total=0;
 for(let i=0;i<n;i++){value+=noise(x*freq,y*freq,z*freq)*amp;total+=amp;amp*=.5;freq*=2;}
 return value/total;
}
export function ridged(x,y,z,n=4){
 let value=0,amp=.5,freq=1,total=0;
 for(let i=0;i<n;i++){value+=(1-Math.abs(noise(x*freq,y*freq,z*freq)*2-1))*amp;total+=amp;amp*=.5;freq*=2.05;}
 return value/total;
}
function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
function smooth(a,b,v){const t=clamp((v-a)/(b-a),0,1);return t*t*(3-2*t);}
export function terrainAt(d){
 const {x,y,z}=d;
 const ca=fbm(x*1.15+4,y*1.15-2,z*1.15+7,5);
 const cb=fbm(x*2-13,y*2+8,z*2+2,4);
 const continental=ca*.78+cb*.22;
 const ra=fbm(x*2.8-11,y*2.8+6,z*2.8+3,5);
 const rb=fbm(x*4.8+18,y*4.8-9,z*4.8-14,4);
 const regional=ra*.72+rb*.28;
 const detail=fbm(x*10+9,y*10-14,z*10+2,3);
 const mountain=smooth(.44,.76,ridged(x*2.35+23,y*2.35-17,z*2.35+5,5)*.48+ridged(x*5-7,y*5+13,z*5-19,4)*.27+ridged(x*9+31,y*9-21,z*9+11,3)*.05+regional*.20);
 const land=smooth(.45,.60,continental);
 const elevation=ra*.70+rb*.22+detail*.08;
 const mask=land*smooth(.52,.80,elevation)*mountain;
 if(land<.5)return {isLand:false,land,elevation,detail,mountainMask:0,height:1};
 const e=clamp((elevation-.30)/.70,0,1);
 return {isLand:true,land,elevation,detail,mountainMask:mask,landElevation:e,height:1.006+smooth(.50,.72,land)*.012+Math.pow(e,1.25)*.045+Math.pow(mask,1.45)*.105};
}
export function terrainColor(t){
 if(!t.isLand)return [.012,.17,.29,1];
 const e=t.landElevation,m=t.mountainMask;
 const A=[.18,.39,.20],B=[.40,.54,.26],C=[.60,.49,.29],D=[.42,.41,.39],E=[.82,.84,.84];
 const mix=(a,b,k)=>a+(b-a)*k;
 let r=A[0],g=A[1],b=A[2],k=smooth(.08,.36,e);
 r=mix(r,B[0],k);g=mix(g,B[1],k);b=mix(b,B[2],k);
 k=smooth(.34,.62,e);r=mix(r,C[0],k);g=mix(g,C[1],k);b=mix(b,C[2],k);
 k=smooth(.48,.72,m);r=mix(r,D[0],k);g=mix(g,D[1],k);b=mix(b,D[2],k);
 k=smooth(.76,1,m+e*.18);r=mix(r,E[0],k);g=mix(g,E[1],k);b=mix(b,E[2],k);
 const v=.94+(t.detail-.5)*.10;return [r*v,g*v,b*v,1];
}