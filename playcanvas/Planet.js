import * as pc from "playcanvas";
import { terrainAt, terrainColor } from "./Terrain.js";

const norm=(x,y,z)=>{const l=Math.hypot(x,y,z);return [x/l,y/l,z/l];};
const point=d=>{const t=terrainAt({x:d[0],y:d[1],z:d[2]});return [d[0]*t.height,d[1]*t.height,d[2]*t.height];};

function normal(d){
 let tx,ty,tz;
 if(Math.abs(d[1])<.9){tx=-d[2];ty=0;tz=d[0];}
 else{tx=-d[1];ty=d[0];tz=0;}
 const tl=Math.hypot(tx,ty,tz);tx/=tl;ty/=tl;tz/=tl;
 const bx=d[1]*tz-d[2]*ty,by=d[2]*tx-d[0]*tz,bz=d[0]*ty-d[1]*tx;
 const e=.0015,p0=point(d),p1=point(norm(d[0]+tx*e,d[1]+ty*e,d[2]+tz*e)),p2=point(norm(d[0]+bx*e,d[1]+by*e,d[2]+bz*e));
 const ax=p1[0]-p0[0],ay=p1[1]-p0[1],az=p1[2]-p0[2],cx=p2[0]-p0[0],cy=p2[1]-p0[1],cz=p2[2]-p0[2];
 let nx=ay*cz-az*cy,ny=az*cx-ax*cz,nz=ax*cy-ay*cx,l=Math.hypot(nx,ny,nz)||1;
 nx/=l;ny/=l;nz/=l;if(nx*d[0]+ny*d[1]+nz*d[2]<0){nx=-nx;ny=-ny;nz=-nz;}return [nx,ny,nz];
}

export function createPlanet(app,resolution=64){
 const positions=[],normals=[],colors=[],indices=[];
 for(const face of ["px","nx","py","ny","pz","nz"]){
  const base=positions.length/3;
  for(let row=0;row<=resolution;row++)for(let col=0;col<=resolution;col++){
   const u=col/resolution*2-1,v=row/resolution*2-1;let x=0,y=0,z=0;
   if(face==="px"){x=1;y=v;z=-u}if(face==="nx"){x=-1;y=v;z=u}
   if(face==="py"){x=u;y=1;z=v}if(face==="ny"){x=u;y=-1;z=-v}
   if(face==="pz"){x=u;y=v;z=1}if(face==="nz"){x=-u;y=v;z=-1}
   const d=norm(x,y,z),t=terrainAt({x:d[0],y:d[1],z:d[2]}),p=[d[0]*t.height,d[1]*t.height,d[2]*t.height],n=normal(d),c=terrainColor(t);
   positions.push(...p);normals.push(...n);colors.push(...c);
  }
  const s=resolution+1;
  for(let row=0;row<resolution;row++)for(let col=0;col<resolution;col++){
   const a=base+row*s+col,b=a+1,c=a+s,d=c+1;indices.push(a,c,b,b,c,d);
  }
 }
 fixWinding(indices,positions);
 const mesh=new pc.Mesh(app.graphicsDevice);
 mesh.setPositions(new Float32Array(positions));
 mesh.setNormals(new Float32Array(normals));
 mesh.setColors(new Float32Array(colors),4);
 mesh.setIndices(indices);mesh.update(pc.PRIMITIVE_TRIANGLES);
 const material=new pc.StandardMaterial();
 material.diffuse.set(1,1,1);material.diffuseVertexColor=true;material.specular.set(.12,.12,.12);material.gloss=.18;material.update();
 return {mesh,material,meshInstance:new pc.MeshInstance(mesh,material)};
}