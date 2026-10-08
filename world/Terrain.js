import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";

const noiseSeed = 42;

function hash3D(x, y, z) {
    const value = Math.sin(x * 127.1 + y * 311.7 + z * 74.7 + noiseSeed) * 43758.5453;
    return value - Math.floor(value);
}

function fade(value) {
    return value * value * value * (value * (value * 6 - 15) + 10);
}

function noise3D(x, y, z) {
    const x0 = Math.floor(x), y0 = Math.floor(y), z0 = Math.floor(z);
    const tx = fade(x - x0), ty = fade(y - y0), tz = fade(z - z0);
    const n000 = hash3D(x0,y0,z0), n100 = hash3D(x0+1,y0,z0);
    const n010 = hash3D(x0,y0+1,z0), n110 = hash3D(x0+1,y0+1,z0);
    const n001 = hash3D(x0,y0,z0+1), n101 = hash3D(x0+1,y0,z0+1);
    const n011 = hash3D(x0,y0+1,z0+1), n111 = hash3D(x0+1,y0+1,z0+1);
    const nx00=n000+(n100-n000)*tx, nx10=n010+(n110-n010)*tx;
    const nx01=n001+(n101-n001)*tx, nx11=n011+(n111-n011)*tx;
    const nxy0=nx00+(nx10-nx00)*ty, nxy1=nx01+(nx11-nx01)*ty;
    return nxy0+(nxy1-nxy0)*tz;
}

export function fbm(x,y,z,octaves=4) {
    let value=0, amplitude=1, frequency=1, total=0;
    for(let i=0;i<octaves;i++){ value+=noise3D(x*frequency,y*frequency,z*frequency)*amplitude; total+=amplitude; amplitude*=0.5; frequency*=2; }
    return value/total;
}

export function ridgedFbm(x,y,z,octaves=4) {
    let value=0, amplitude=0.5, frequency=1, total=0;
    for(let i=0;i<octaves;i++){ const n=noise3D(x*frequency,y*frequency,z*frequency); value+=(1-Math.abs(n*2-1))*amplitude; total+=amplitude; amplitude*=0.5; frequency*=2.05; }
    return value/total;
}

export function smoothstep(edge0,edge1,value) {
    const t=THREE.MathUtils.clamp((value-edge0)/(edge1-edge0),0,1);
    return t*t*(3-2*t);
}

export function terrainAt(direction) {
    const {x,y,z}=direction;
    const continentA=fbm(x*1.15+4,y*1.15-2,z*1.15+7,5);
    const continentB=fbm(x*2-13,y*2+8,z*2+2,4);
    const continental=continentA*0.78+continentB*0.22;
    const regionalA=fbm(x*2.8-11,y*2.8+6,z*2.8+3,5);
    const regionalB=fbm(x*4.8+18,y*4.8-9,z*4.8-14,4);
    const regional=regionalA*0.72+regionalB*0.28;
    const detail=fbm(x*10+9,y*10-14,z*10+2,3);
    const ridgeLarge=ridgedFbm(x*2.35+23,y*2.35-17,z*2.35+5,5);
    const ridgeRegional=ridgedFbm(x*5-7,y*5+13,z*5-19,4);
    const ridgeDetail=ridgedFbm(x*9+31,y*9-21,z*9+11,3);
    const land=smoothstep(0.45,0.60,continental);
    const elevation=regionalA*0.70+regionalB*0.22+detail*0.08;
    const mountainBelts=smoothstep(0.52,0.80,elevation);
    const mountainStructure=ridgeLarge*0.48+ridgeRegional*0.27+ridgeDetail*0.05+regional*0.20;
    const mountainMask=land*mountainBelts*smoothstep(0.44,0.76,mountainStructure);
    if(land<0.5) return {isLand:false,land,elevation,detail,mountainMask:0,height:1};
    const coast=smoothstep(0.50,0.72,land);
    const landElevation=THREE.MathUtils.clamp((elevation-0.30)/0.70,0,1);
    const rolling=Math.pow(landElevation,1.25)*0.045;
    const mountains=Math.pow(mountainMask,1.45)*0.105;
    return {isLand:true,land,elevation,detail,mountainMask,landElevation,coast,height:1.006+coast*0.012+rolling+mountains};
}

export function terrainColor(terrain, colors) {
    const {lowlandColor,meadowColor,dryColor,rockColor,snowColor}=colors;
    if(!terrain.isLand) return new THREE.Color(0x064d78);
    const color=new THREE.Color();
    const e=terrain.landElevation, m=terrain.mountainMask;
    color.copy(lowlandColor);
    color.lerp(meadowColor,smoothstep(0.08,0.36,e));
    color.lerp(dryColor,smoothstep(0.34,0.62,e));
    color.lerp(rockColor,smoothstep(0.48,0.72,m));
    color.lerp(snowColor,smoothstep(0.76,1.0,m+e*0.18));
    color.multiplyScalar(0.94+(terrain.detail-0.5)*0.10);
    return color;
}
