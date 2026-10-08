import * as pc from "playcanvas";
import { terrainAt, terrainColor } from "./Terrain.js";

const PHI=(1+Math.sqrt(5))/2;

function normalize(v){
 const l=Math.hypot(v[0],v[1],v[2])||1;
 return [v[0]/l,v[1]/l,v[2]/l];
}

function midpoint(a,b){
 return normalize([(a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2]);
}

function buildIcosphere(subdivisions=7){
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

function sphericalUv(d){
 const u=.5+Math.atan2(d[2],d[0])/(Math.PI*2);
 const v=.5-Math.asin(Math.max(-1,Math.min(1,d[1])))/Math.PI;
 return [u,v];
}

function createPlanetTexture(app,size=2048){
 const canvas=document.createElement("canvas");
 canvas.width=size;
 canvas.height=size/2;

 const ctx=canvas.getContext("2d",{alpha:false});
 const image=ctx.createImageData(canvas.width,canvas.height);
 const data=image.data;

 for(let py=0;py<canvas.height;py++){
  const v=py/(canvas.height-1);
  const lat=(.5-v)*Math.PI;
  const cosLat=Math.cos(lat);
  const sinLat=Math.sin(lat);

  for(let px=0;px<canvas.width;px++){
   const u=px/(canvas.width-1);
   const lon=(u-.5)*Math.PI*2;
   const d={
    x:cosLat*Math.cos(lon),
    y:sinLat,
    z:cosLat*Math.sin(lon)
   };

   const c=terrainColor(terrainAt(d));
   const i=(py*canvas.width+px)*4;
   data[i]=Math.round(c[0]*255);
   data[i+1]=Math.round(c[1]*255);
   data[i+2]=Math.round(c[2]*255);
   data[i+3]=255;
  }
 }

 ctx.putImageData(image,0,0);

 const texture=new pc.Texture(app.graphicsDevice,{
  width:canvas.width,
  height:canvas.height,
  format:pc.PIXELFORMAT_R8_G8_B8_A8,
  mipmaps:true,
  minFilter:pc.FILTER_LINEAR_MIPMAP_LINEAR,
  magFilter:pc.FILTER_LINEAR,
  addressU:pc.ADDRESS_REPEAT,
  addressV:pc.ADDRESS_CLAMP_TO_EDGE
 });
 texture.setSource(canvas);
 return texture;
}

export function createPlanet(app){
 const {vertices,faces}=buildIcosphere(7);

 const surface=vertices.map(d=>{
  const t=terrainAt({x:d[0],y:d[1],z:d[2]});
  return [d[0]*t.height,d[1]*t.height,d[2]*t.height];
 });

 const positions=[],normals=[],uvs=[],indices=[];

 for(const [ia,ib,ic] of faces){
  const face=[vertices[ia],vertices[ib],vertices[ic]];
  const uv=face.map(sphericalUv);
  const maxU=Math.max(uv[0][0],uv[1][0],uv[2][0]);
  const minU=Math.min(uv[0][0],uv[1][0],uv[2][0]);

  if(maxU-minU>.5){
   for(const q of uv)if(q[0]<.5)q[0]+=1;
  }

  const start=positions.length/3;

  for(let k=0;k<3;k++){
   const d=face[k];
   const p=surface[[ia,ib,ic][k]];

   positions.push(...p);
   normals.push(...normalize(d));
   uvs.push(uv[k][0],uv[k][1]);
  }

  indices.push(start,start+1,start+2);
 }

 const mesh=new pc.Mesh(app.graphicsDevice);
 mesh.setPositions(new Float32Array(positions));
 mesh.setNormals(new Float32Array(normals));
 mesh.setUvs(0,new Float32Array(uvs));
 mesh.setIndices(indices);
 mesh.update(pc.PRIMITIVE_TRIANGLES);

 const material=new pc.StandardMaterial();
 const texture=createPlanetTexture(app,2048);

 material.diffuse.set(0,0,0);
 material.emissive.set(1,1,1);
 material.emissiveMap=texture;
 material.specular.set(0,0,0);
 material.gloss=0;
 material.cull=pc.CULLFACE_BACK;
 material.update();

 return {
  mesh,
  material,
  meshInstance:new pc.MeshInstance(mesh,material)
 };
}
