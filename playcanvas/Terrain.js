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
 const b=n(0,1,0)+(n(1,1,0)-n(0,1,0))*u;
 const c=n(0,0,1)+(n(1,0,1)-n(0,0,1))*u;
 const d=n(0,1,1)+(n(1,1,1)-n(0,1,1))*u;
 return (a+(b-a)*v)+((c+(d-c)*v)-(a+(b-a)*v))*w;
}
export function fbm(x,y,z,n=5){
 let value=0,amp=1,freq=1,total=0;
 for(let i=0;i<n;i++){value+=noise(x*freq,y*freq,z*freq)*amp;total+=amp;amp*=.5;freq*=2.01;}
 return value/total;
}
export function ridged(x,y,z,n=5){
 let value=0,amp=.5,freq=1,total=0;
 for(let i=0;i<n;i++){value+=(1-Math.abs(noise(x*freq,y*freq,z*freq)*2-1))*amp;total+=amp;amp*=.52;freq*=2.03;}
 return value/total;
}
function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
function smooth(a,b,v){
 const t=clamp((v-a)/(b-a),0,1);
 return t*t*(3-2*t);
}
function mix(a,b,t){return a+(b-a)*t;}

function warp(d){
 const {x,y,z}=d;
 return {
  x:x+(fbm(x*1.9+19,y*1.9-7,z*1.9+3,4)-.5)*.28,
  y:y+(fbm(x*1.9-11,y*1.9+17,z*1.9+29,4)-.5)*.28,
  z:z+(fbm(x*1.9+31,y*1.9+5,z*1.9-13,4)-.5)*.28
 };
}

export function terrainAt(d){
 const w=warp(d);
 const {x,y,z}=w;

 // A dedicated macro field creates continent-sized masses. Domain warping
 // breaks the perfect "noise blob" look and gives coastlines a natural shape.
 const macro=
   fbm(x*1.35+5,y*1.35-9,z*1.35+17,7)*.72+
   fbm(x*2.7-13,y*2.7+7,z*2.7+2,5)*.28;

 // Independent coastal breakup: this modifies the shoreline without destroying
 // the large continental silhouette.
 const coastNoise=fbm(x*7.5+8,y*7.5-21,z*7.5+14,5);
 const coastWarp=macro+(coastNoise-.5)*.105;
 const land=smooth(.435,.555,coastWarp);

 // Terrain fields are independent from the continent field. This prevents the
 // surface from looking like one giant painted noise map.
 const regional=fbm(x*5.2-4,y*5.2+16,z*5.2-12,6);
 const detail=fbm(x*16+21,y*16-8,z*16+4,5);
 const micro=fbm(x*48-17,y*48+11,z*48+27,4);
 const grain=fbm(x*105+7,y*105-31,z*105+19,3);

 // Mountain systems are coherent ridges, not random bumps. A broad mountain
 // field is sharpened by a second ridge field.
 const ridgeA=ridged(x*3.2+33,y*3.2-17,z*3.2+9,7);
 const ridgeB=ridged(x*8.5-6,y*8.5+27,z*8.5-19,5);
 const mountainField=ridgeA*.78+ridgeB*.22;
 const inland=smooth(.50,.67,macro);
 const mountains=smooth(.50,.76,mountainField)*inland;

 const elevation=regional*.38+detail*.30+micro*.22+grain*.10;
 const e=clamp((elevation-.30)/.70,0,1);

 if(land<.5){
  return {isLand:false,land,elevation,detail,micro,grain,mountainMask:0,landElevation:0,height:1};
 }

 const height=
   1.0015+
   smooth(.48,.60,coastWarp)*.012+
   e*.025+
   Math.pow(mountains,1.45)*.095+
   micro*.004;

 // Moisture is deliberately separate from elevation. That gives us forests,
 // plains and dry regions instead of a single altitude-based paint gradient.
 const moistureRaw=
   fbm(x*3.1-41,y*3.1+13,z*3.1+22,5)*.72+
   fbm(x*11+9,y*11-7,z*11+5,4)*.28;
 // FBM naturally clusters around its midpoint. Expand its useful range so
 // deserts, grasslands and humid forests occupy genuinely different regions.
 const moisture=clamp((moistureRaw-.405)/.19,0,1);

 return {
  isLand:true,land,elevation,detail,micro,grain,
  mountainMask:mountains,landElevation:e,height,moisture,y
 };
}

export function terrainColor(t){
 if(!t.isLand)return [.006,.035,.105,1];

 const e=t.landElevation??0;
 const m=t.mountainMask??0;
 const moisture=t.moisture??.5;
 const detail=t.detail??.5;
 const micro=t.micro??.5;
 const grain=t.grain??.5;
 const latitude=Math.abs(t.y??0);

 // Clearly separated biome families: arid deserts, open grasslands,
 // temperate forests, humid forests and cold tundra.
 const desert=smooth(.30,.48,1-moisture);
 const forest=smooth(.48,.72,moisture);
 const wetForest=smooth(.68,.86,moisture);
 const highland=smooth(.38,.68,e);
 const polar=smooth(.66,.94,latitude);

 let r=mix(.22,.53,desert);
 let g=mix(.39,.36,desert);
 let b=mix(.12,.19,desert);

 // Grasslands and temperate ground remain distinct from deserts.
 const grass=smooth(.22,.48,moisture)*(1-smooth(.68,.84,moisture));
 r=mix(r,.30,grass*.75);
 g=mix(g,.49,grass*.85);
 b=mix(b,.16,grass*.65);

 // Moisture-rich regions become visibly darker and denser green.
 r=mix(r,.075,forest*.78);
 g=mix(g,.29,forest*.72);
 b=mix(b,.085,forest*.78);
 r=mix(r,.045,wetForest*.38);
 g=mix(g,.205,wetForest*.38);
 b=mix(b,.065,wetForest*.38);

 // Dry high plateaus, exposed rock and mountain ridges.
 const rock=clamp(highland*(.25+.75*smooth(.45,.76,m)),0,1);
 r=mix(r,.39,rock*.88);
 g=mix(g,.36,rock*.88);
 b=mix(b,.30,rock*.88);

 // Cold high-latitude terrain shifts toward muted moss, stone and frost.
 const tundra=polar*(1-smooth(.76,.96,m));
 r=mix(r,.39,tundra*.7);
 g=mix(g,.42,tundra*.7);
 b=mix(b,.34,tundra*.7);

 // Snow is limited to the highest peaks and coldest regions.
 const snow=Math.max(smooth(.76,.96,m+e*.20),polar*smooth(.48,.72,e)*.72);
 r=mix(r,.84,snow);
 g=mix(g,.87,snow);
 b=mix(b,.89,snow);

 // Multiscale albedo breakup adds visible small-scale surface texture
 // without adding more expensive geometry.
 const broad=.90+(detail-.5)*.26;
 const fine=1+(micro-.5)*.30+(grain-.5)*.18;
 const patch=1+(smooth(.35,.75,detail)-.5)*.10;
 const variation=broad*fine*patch;

 return [
  clamp(r*variation,0,1),
  clamp(g*variation,0,1),
  clamp(b*variation,0,1),
  1
 ];
}
