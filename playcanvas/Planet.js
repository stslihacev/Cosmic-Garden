import * as pc from "playcanvas";
import { terrainAt } from "./Terrain.js";

const PHI=(1+Math.sqrt(5))/2;

function normalize(v){
 const l=Math.hypot(v[0],v[1],v[2])||1;
 return [v[0]/l,v[1]/l,v[2]/l];
}
function midpoint(a,b){
 return normalize([(a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2]);
}
function buildIcosphere(subdivisions=6){
 const base=[
  [-1,PHI,0],[1,PHI,0],[-1,-PHI,0],[1,-PHI,0],
  [0,-1,PHI],[0,1,PHI],[0,-1,-PHI],[0,1,-PHI],
  [PHI,0,-1],[PHI,0,1],[-PHI,0,-1],[-PHI,0,1]
 ].map(normalize);
 let faces=[
  [0,11,5],[0,5,1],[0,1,7],[0,7,10],[0,10,11],
  [1,5,9],[5,11,4],[11,10,2],[10,7,6],[7,1,8],
  [3,9,4],[3,4,2],[3,2,6],[3,6,8],[3,8,9],
  [4,9,5],[2,4,11],[6,2,10],[8,6,7],[9,8,1]
 ];
 for(let s=0;s<subdivisions;s++){
  const cache=new Map(),next=[];
  const get=(a,b)=>{
   const k=a<b?a+","+b:b+","+a;
   if(cache.has(k))return cache.get(k);
   const v=midpoint(base[a],base[b]);
   base.push(v);
   const i=base.length-1;
   cache.set(k,i);
   return i;
  };
  for(const [a,b,c] of faces){
   const ab=get(a,b),bc=get(b,c),ca=get(c,a);
   next.push([a,ab,ca],[b,bc,ab],[c,ca,bc],[ab,bc,ca]);
  }
  faces=next;
 }
 return {vertices:base,faces};
}

// Surface appearance is evaluated per visible pixel on the GPU, not baked into
// a small equirectangular image. This keeps fine detail crisp when zooming in.
const vertexShader=`
attribute vec3 aPosition;
uniform mat4 matrix_model;
uniform mat4 matrix_viewProjection;
varying vec3 vLocalDir;
varying vec3 vWorldPos;
varying vec3 vWorldNormal;
void main(void) {
    vLocalDir = normalize(aPosition);
    vec4 worldPos = matrix_model * vec4(aPosition, 1.0);
    vWorldPos = worldPos.xyz;
    vWorldNormal = normalize(mat3(matrix_model) * normalize(aPosition));
    gl_Position = matrix_viewProjection * worldPos;
}
`;

const fragmentShader=`
precision highp float;
varying vec3 vLocalDir;
varying vec3 vWorldPos;
varying vec3 vWorldNormal;

// These noise functions mirror Terrain.js so the coastline rendered by
// the shader follows the same field that determines the actual land mesh.
float hash31(vec3 p) {
    return fract(sin(dot(p, vec3(127.1, 311.7, 74.7)) + 42.0) * 43758.5453);
}
float noise3(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f*f*f*(f*(f*6.0-15.0)+10.0);
    float n000=hash31(i+vec3(0.0,0.0,0.0));
    float n100=hash31(i+vec3(1.0,0.0,0.0));
    float n010=hash31(i+vec3(0.0,1.0,0.0));
    float n110=hash31(i+vec3(1.0,1.0,0.0));
    float n001=hash31(i+vec3(0.0,0.0,1.0));
    float n101=hash31(i+vec3(1.0,0.0,1.0));
    float n011=hash31(i+vec3(0.0,1.0,1.0));
    float n111=hash31(i+vec3(1.0,1.0,1.0));
    float x00=mix(n000,n100,f.x);
    float x10=mix(n010,n110,f.x);
    float x01=mix(n001,n101,f.x);
    float x11=mix(n011,n111,f.x);
    return mix(mix(x00,x10,f.y),mix(x01,x11,f.y),f.z);
}
float terrainFbm(vec3 p, int octaves) {
    float value=0.0;
    float amplitude=1.0;
    float frequency=1.0;
    float total=0.0;
    for(int i=0;i<7;i++) {
        if(i<octaves) {
            value+=noise3(p*frequency)*amplitude;
            total+=amplitude;
            amplitude*=0.5;
            frequency*=2.01;
        }
    }
    return value/max(total,0.0001);
}
vec3 terrainWarp(vec3 d) {
    return d + vec3(
        (terrainFbm(d*1.9+vec3(19.0,-7.0,3.0),4)-0.5)*0.28,
        (terrainFbm(d*1.9+vec3(-11.0,17.0,29.0),4)-0.5)*0.28,
        (terrainFbm(d*1.9+vec3(31.0,5.0,-13.0),4)-0.5)*0.28
    );
}
float fbm(vec3 p) {
    float v=0.0;
    float a=0.5;
    for(int i=0;i<5;i++) {
        v += noise3(p)*a;
        p *= 2.03;
        a *= 0.5;
    }
    return v/0.96875;
}
float ridge(vec3 p) {
    float v=0.0;
    float a=0.5;
    for(int i=0;i<4;i++) {
        float n=noise3(p);
        v += (1.0-abs(n*2.0-1.0))*a;
        p *= 2.02;
        a *= 0.5;
    }
    return v/0.9375;
}
float sm(float a,float b,float x) {
    float t=clamp((x-a)/(b-a),0.0,1.0);
    return t*t*(3.0-2.0*t);
}
void main(void) {
    vec3 d=normalize(vLocalDir);
    // Match Terrain.js exactly for the large-scale continent and coastline.
    vec3 warped=terrainWarp(d);
    float macro=terrainFbm(warped*1.35+vec3(5.0,-9.0,17.0),7)*0.72
               +terrainFbm(warped*2.7+vec3(-13.0,7.0,2.0),5)*0.28;
    float coastNoise=terrainFbm(warped*7.5+vec3(8.0,-21.0,14.0),5);
    float landField=macro+(coastNoise-0.5)*0.105;
    float continent=macro;
    float land=sm(0.435,0.555,landField);

    // Deep ocean colour remains visible through the transparent coastal mask.
    vec3 ocean=mix(vec3(0.004,0.025,0.075),vec3(0.012,0.095,0.16),
                   sm(0.30,0.72,fbm(d*8.0+vec3(2.0,17.0,4.0))));

    // Match Terrain.js moisture scales so biome regions remain broad and coherent.
    float moistureRaw=terrainFbm(warped*3.1+vec3(-41.0,13.0,22.0),5)*0.72
                     +terrainFbm(warped*11.0+vec3(9.0,-7.0,5.0),4)*0.28;
    float moisture=clamp((moistureRaw-0.405)/0.19,0.0,1.0);
    float latitude=abs(d.y);

    float mountainBase=ridge(warped*11.0+vec3(33.0,-17.0,9.0));
    float mountainRidge=ridge(warped*27.0+vec3(-6.0,27.0,-19.0));
    float mountain=sm(0.49,0.78,mountainBase*0.76+mountainRidge*0.24)
                  *sm(0.43,0.61,continent);

    float macroDetail=fbm(warped*38.0+vec3(21.0,-8.0,4.0));
    float microDetail=fbm(warped*105.0+vec3(-17.0,11.0,27.0));
    float grain= noise3(warped*260.0+vec3(7.0,-31.0,19.0));
    float fine= noise3(warped*520.0+vec3(19.0,41.0,-13.0));

    // Use clear biome families first; avoid blending every biome into one
    // continuous muddy gradient.
    vec3 desertColor=vec3(0.56,0.405,0.22);
    vec3 grassColor=vec3(0.31,0.47,0.17);
    vec3 forestColor=vec3(0.055,0.235,0.075);
    vec3 wetForestColor=vec3(0.025,0.135,0.045);
    float dryMask=1.0-smoothstep(0.36,0.49,moisture);
    float grassMask=smoothstep(0.34,0.47,moisture)*(1.0-smoothstep(0.57,0.68,moisture));
    float forestMask=smoothstep(0.52,0.66,moisture)*(1.0-smoothstep(0.78,0.88,moisture));
    float wetMask=smoothstep(0.74,0.86,moisture);
    // Ordered transitions: broad biome masks define regions; fine noise only decorates them.
    vec3 landColor=desertColor;
    landColor=mix(landColor,grassColor,grassMask);
    landColor=mix(landColor,forestColor,forestMask);
    landColor=mix(landColor,wetForestColor,wetMask);

    // High-contrast, spatially coherent surface structures. Thresholded noise
    // creates readable vegetation clusters and exposed-soil patches rather
    // than low-contrast blurry colour clouds.
    // Keep colour variation subordinate to the large biome map. Fine detail
    // should read as terrain texture, not as a planet-wide patchwork of colours.
    float patchLarge=noise3(warped*18.0+vec3(16.0,3.0,29.0));
    float patchMedium=noise3(warped*52.0+vec3(-17.0,11.0,27.0));
    float patchFine=noise3(warped*135.0+vec3(7.0,-31.0,19.0));
    float vegetationClusters=smoothstep(0.47,0.64,patchLarge);
    float exposedGround=smoothstep(0.61,0.78,patchMedium);
    float microMarks=smoothstep(0.45,0.68,patchFine);

    // Broad forest masses get subtle canopy-density variation; exposed ground
    // is limited to dry areas, and high-frequency grain has low colour contrast.
    landColor=mix(landColor,landColor*vec3(0.72,0.82,0.68),vegetationClusters*forestMask*0.42);
    landColor=mix(landColor,vec3(0.56,0.43,0.27),exposedGround*dryMask*0.38);
    landColor*=mix(0.94,1.045,microMarks);
    landColor*=0.94+macroDetail*0.12;

    vec3 rock=mix(vec3(0.24,0.235,0.21),vec3(0.53,0.49,0.41),mountainRidge);
    float rockySurface=smoothstep(0.25,0.55,mountain);
    float rockStrata=smoothstep(0.44,0.64,noise3(warped*185.0+vec3(37.0,-8.0,14.0)));
    rock=mix(rock,vec3(0.62,0.57,0.47),rockStrata*0.48);
    landColor=mix(landColor,rock,rockySurface*0.98);
    float snow=max(sm(0.72,0.94,mountain+macroDetail*0.13),
                   sm(0.70,0.96,latitude)*sm(0.42,0.72,mountain)*0.75);
    landColor=mix(landColor,vec3(0.82,0.86,0.89),snow);

    // Thin, irregular shoreline highlights the shape of the coast.
    float shore=1.0-smoothstep(0.008,0.035,abs(landField-0.5));
    landColor=mix(landColor,vec3(0.60,0.59,0.43),shore*land*0.24);

    vec3 color=mix(ocean,landColor,land);
    vec3 N=normalize(vWorldNormal);
    vec3 L=normalize(vec3(-0.45,0.38,0.82));
    float diffuse=0.58+0.42*max(dot(N,L),0.0);
    float rim=pow(1.0-max(dot(N,normalize(-vWorldPos)),0.0),2.0);
    color*=diffuse;
    color+=vec3(0.015,0.055,0.10)*rim*0.5;
    gl_FragColor=vec4(color,1.0);
}
`;

export function createPlanet(app){
 const {vertices,faces}=buildIcosphere(6);
 const surface=vertices.map(d=>{
  const t=terrainAt({x:d[0],y:d[1],z:d[2]});
  // Keep land above the ocean shell while retaining the existing macro relief.
  const radius=t.isLand?Math.max(t.height,1.007):1.0;
  return [d[0]*radius,d[1]*radius,d[2]*radius];
 });
 const positions=[],normals=[],indices=[];
 for(const [ia,ib,ic] of faces){
  const start=positions.length/3;
  for(const index of [ia,ib,ic]){
   const d=vertices[index],p=surface[index];
   positions.push(...p);
   normals.push(...normalize(d));
  }
  indices.push(start,start+1,start+2);
 }
 const mesh=new pc.Mesh(app.graphicsDevice);
 mesh.setPositions(new Float32Array(positions));
 mesh.setNormals(new Float32Array(normals));
 mesh.setIndices(indices);
 mesh.update(pc.PRIMITIVE_TRIANGLES);

 const material=new pc.ShaderMaterial({
  uniqueName:"CosmicGardenProceduralSurfaceV1",
  attributes:{aPosition:pc.SEMANTIC_POSITION,aNormal:pc.SEMANTIC_NORMAL},
  vertexGLSL:vertexShader,
  fragmentGLSL:fragmentShader
 });
 material.cull=pc.CULLFACE_BACK;
 material.update();

 return {mesh,material,meshInstance:new pc.MeshInstance(mesh,material)};
}
