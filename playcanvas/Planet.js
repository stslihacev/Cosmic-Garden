import * as pc from "playcanvas";
import { terrainAt, terrainColor } from "./Terrain.js";

const PHI=(1+Math.sqrt(5))/2;
function normalize(v){const l=Math.hypot(v[0],v[1],v[2])||1;return [v[0]/l,v[1]/l,v[2]/l];}
function midpoint(a,b){return normalize([(a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2]);}
function buildIcosphere(subdivisions=5){
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
  const get=(a,b)=>{const k=a<b?a+","+b:b+","+a;if(cache.has(k))return cache.get(k);const v=midpoint(base[a],base[b]);base.push(v);const i=base.length-1;cache.set(k,i);return i;};
  for(const [a,b,c] of faces){const ab=get(a,b),bc=get(b,c),ca=get(c,a);next.push([a,ab,ca],[b,bc,ab],[c,ca,bc],[ab,bc,ca]);}
  faces=next;
 }
 return {vertices:base,faces};
}
export function createPlanet(app){
 const {vertices,faces}=buildIcosphere(6);
 const positions=[],normals=[],colors=[],indices=[];
 for(const d of vertices){
  const t=terrainAt({x:d[0],y:d[1],z:d[2]});
  const p=[d[0]*t.height,d[1]*t.height,d[2]*t.height];
  positions.push(...p);normals.push(...normalize(p));colors.push(...terrainColor(t));
 }
 for(const f of faces)indices.push(...f);
 const mesh=new pc.Mesh(app.graphicsDevice);
 mesh.setPositions(new Float32Array(positions));
 mesh.setNormals(new Float32Array(normals));
 mesh.setColors(new Float32Array(colors),4);
 mesh.setIndices(indices);
 mesh.update(pc.PRIMITIVE_TRIANGLES);
 const material=new pc.StandardMaterial();
 material.diffuse.set(0.75,0.75,0.75);
 material.emissive.set(0.22,0.22,0.22);
 material.emissiveVertexColor=true;
 material.diffuseVertexColor=true;
 material.specular.set(.08,.08,.08);
 material.gloss=.12;
 material.cull=pc.CULLFACE_BACK;
 material.update();
 return {mesh,material,meshInstance:new pc.MeshInstance(mesh,material)};
}