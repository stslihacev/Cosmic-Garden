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

float hash31(vec3 p) {
    p = fract(p * 0.1031);
    p += dot(p, p.yzx + 33.33);
    return fract((p.x + p.y) * p.z);
}
float noise3(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f*f*(3.0-2.0*f);
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
    vec3 warped=d+(vec3(
        fbm(d*3.0+vec3(13.0,2.0,7.0)),
        fbm(d*3.0+vec3(31.0,9.0,17.0)),
        fbm(d*3.0+vec3(5.0,27.0,11.0))
    )-0.5)*0.22;

    float continent=fbm(warped*3.2+vec3(5.0,-9.0,17.0))*0.72
                   +fbm(warped*6.4+vec3(-13.0,7.0,2.0))*0.28;
    float coastDetail=fbm(warped*18.0+vec3(8.0,-21.0,14.0));
    float landField=continent+(coastDetail-0.5)*0.10;
    float land=sm(0.465,0.535,landField);

    // Deep ocean colour remains visible through the transparent coastal mask.
    vec3 ocean=mix(vec3(0.004,0.025,0.075),vec3(0.012,0.095,0.16),
                   sm(0.30,0.72,fbm(d*8.0+vec3(2.0,17.0,4.0))));

    float moistureRaw=fbm(warped*7.0+vec3(-41.0,13.0,22.0))*0.72
                     +fbm(warped*23.0+vec3(9.0,-7.0,5.0))*0.28;
    float moisture=clamp((moistureRaw-0.39)/0.22,0.0,1.0);
    float latitude=abs(d.y);

    float mountainBase=ridge(warped*11.0+vec3(33.0,-17.0,9.0));
    float mountainRidge=ridge(warped*27.0+vec3(-6.0,27.0,-19.0));
    float mountain=sm(0.49,0.78,mountainBase*0.76+mountainRidge*0.24)
                  *sm(0.43,0.61,continent);

    float macroDetail=fbm(warped*38.0+vec3(21.0,-8.0,4.0));
    float microDetail=fbm(warped*105.0+vec3(-17.0,11.0,27.0));
    float grain= noise3(warped*260.0+vec3(7.0,-31.0,19.0));
    float fine= noise3(warped*520.0+vec3(19.0,41.0,-13.0));

    vec3 landColor=mix(vec3(0.46,0.35,0.19),vec3(0.31,0.46,0.17),
                       sm(0.25,0.48,moisture));
    landColor=mix(landColor,vec3(0.075,0.24,0.085),sm(0.48,0.70,moisture)*0.88);
    landColor=mix(landColor,vec3(0.035,0.15,0.055),sm(0.70,0.86,moisture)*0.55);

    // Distinct dry soil patches, vegetation breakup and rocky regions at
    // several spatial frequencies make the surface read as terrain, not paint.
    float dryPatch=fbm(warped*52.0+vec3(16.0,3.0,29.0));
    landColor=mix(landColor,vec3(0.58,0.43,0.25),sm(0.57,0.75,1.0-moisture)*sm(0.46,0.69,dryPatch)*0.62);
    landColor*=0.76+macroDetail*0.48;
    landColor*=0.82+microDetail*0.36;
    landColor*=0.83+grain*0.34;
    landColor*=0.90+fine*0.20;

    vec3 rock=mix(vec3(0.28,0.27,0.24),vec3(0.48,0.45,0.39),mountainRidge);
    landColor=mix(landColor,rock,sm(0.30,0.68,mountain)*0.94);
    float snow=max(sm(0.72,0.94,mountain+macroDetail*0.13),
                   sm(0.70,0.96,latitude)*sm(0.42,0.72,mountain)*0.75);
    landColor=mix(landColor,vec3(0.82,0.86,0.89),snow);

    // Thin, irregular shoreline highlights the shape of the coast.
    float shore=1.0-sm(0.0,0.055,abs(landField-0.5));
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
