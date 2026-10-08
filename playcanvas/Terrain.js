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
 const moisture=clamp(
   fbm(x*3.1-41,y*3.1+13,z*3.1+22,5)*.72+
   fbm(x*11+9,y*11-7,z*11+5,4)*.28,
   0,1
 );

 return {
  isLand:true,land,elevation,detail,micro,grain,
  mountainMask:mountains,landElevation:e,height,moisture,y
 };
}

export function terrainColor(t){
 if(!t.isLand)return [.008,.045,.12,1];

 const e=t.landElevation;
 const m=t.mountainMask;
 const moisture=t.moisture??.5;
 const d=t.detail??.5;
 const micro=t.micro??.5;
 const grain=t.grain??.5;

 // Start from biome families rather than painting a single green/brown ramp.
 // Moisture controls vegetation; elevation controls rock/snow.
 let lowland=[.18,.40,.10];
 let dry=[.47,.40,.17];
 let temperate=[.25,.46,.16];
 let lush=[.10,.34,.10];

 let r,g,b;
 const wet=clamp(moisture*.9+(1-Math.abs(e-.38))*0.15,0,1);
 const dryMix=smooth(.25,.62,1-moisture);
 const lushMix=smooth(.38,.78,moisture);

 r=mix(lowland[0],dry[0],dryMix*.55);
 g=mix(lowland[1],dry[1],dryMix*.55);
 b=mix(lowland[2],dry[2],dryMix*.55);

 r=mix(r,temperate[0],smooth(.12,.48,e)*.65);
 g=mix(g,temperate[1],smooth(.12,.48,e)*.65);
 b=mix(b,temperate[2],smooth(.12,.48,e)*.65);

 r=mix(r,lush[0],lushMix*.55);
 g=mix(g,lush[1],lushMix*.55);
 b=mix(b,lush[2],lushMix*.55);

 // Dry highlands and exposed rock.
 const rock=smooth(.48,.72,e)*(.35+.65*smooth(.35,.75,m));
 r=mix(r,.39,rock);g=mix(g,.37,rock);b=mix(b,.31,rock);

 // Snow appears only on the highest mountain ridges.
 const snow=smooth(.72,.94,m+e*.18);
 r=mix(r,.82,snow);g=mix(g,.84,snow);b=mix(b,.86,snow);

 // Latitude shifts the climate softly: this adds large-scale biome structure
 // without creating visible stripes.
 const lat=Math.abs(t.y??0);
 const latitudeDry=smooth(.55,.95,lat)*.18;
 r=mix(r,.48,latitudeDry*(1-moisture));
 g=mix(g,.43,latitudeDry*(1-moisture));
 b=mix(b,.22,latitudeDry*(1-moisture));

 // Fine albedo breakup, kept below the scale where it becomes visual noise.
 const variation=.90+(d-.5)*.22+(micro-.5)*.10+(grain-.5)*.045;
 return [clamp(r*variation,0,1),clamp(g*variation,0,1),clamp(b*variation,0,1),1];
}
