import * as pc from "playcanvas";
import { terrainAt } from "./Terrain.js";

const seed=1337;
function rnd(i){const x=Math.sin(i*12.9898+seed)*43758.5453;return x-Math.floor(x);}
function norm(x,y,z){const l=Math.hypot(x,y,z)||1;return [x/l,y/l,z/l];}
function addTri(pos,idx,a,b,c){const n=pos.length/3;pos.push(...a,...b,...c);idx.push(n,n+1,n+2);}
function addCone(pos,idx,center,n,height,radius,sides,tip){
 const [nx,ny,nz]=n;
 let tx,ty,tz;
 if(Math.abs(ny)<.9){tx=-nz;ty=0;tz=nx;}else{tx=-ny;ty=nx;tz=0;}
 const tl=Math.hypot(tx,ty,tz);tx/=tl;ty/=tl;tz/=tl;
 const bx=ny*tz-nz*ty,by=nz*tx-nx*tz,bz=nx*ty-ny*tx;
 const base=center.map((v,i)=>v+n[i]*height*.25);
 const top=center.map((v,i)=>v+n[i]*height);
 const ring=[];
 for(let j=0;j<sides;j++){const a=j/sides*Math.PI*2,ca=Math.cos(a),sa=Math.sin(a);ring.push([base[0]+(tx*ca+bx*sa)*radius,base[1]+(ty*ca+by*sa)*radius,base[2]+(tz*ca+bz*sa)*radius]);}
 for(let j=0;j<sides;j++)addTri(pos,idx,ring[j],ring[(j+1)%sides],top);
}
function addTrunk(pos,idx,center,n,height,radius,sides){
 const [nx,ny,nz]=n;let tx,ty,tz;
 if(Math.abs(ny)<.9){tx=-nz;ty=0;tz=nx;}else{tx=-ny;ty=nx;tz=0;}
 const tl=Math.hypot(tx,ty,tz);tx/=tl;ty/=tl;tz/=tl;
 const bx=ny*tz-nz*ty,by=nz*tx-nx*tz,bz=nx*ty-ny*tx;
 const bottom=center,top=center.map((v,i)=>v+n[i]*height),r1=[],r2=[];
 for(let j=0;j<sides;j++){const a=j/sides*Math.PI*2,ca=Math.cos(a),sa=Math.sin(a);r1.push([bottom[0]+(tx*ca+bx*sa)*radius,bottom[1]+(ty*ca+by*sa)*radius,bottom[2]+(tz*ca+bz*sa)*radius]);r2.push([top[0]+(tx*ca+bx*sa)*radius,top[1]+(ty*ca+by*sa)*radius,top[2]+(tz*ca+bz*sa)*radius]);}
 for(let j=0;j<sides;j++){addTri(pos,idx,r1[j],r2[j],r1[(j+1)%sides]);addTri(pos,idx,r1[(j+1)%sides],r2[j],r2[(j+1)%sides]);}
}
function mesh(app,pos,idx,color){
 const normals=new Array(pos.length).fill(0);
 for(let i=0;i<idx.length;i+=3){
  const ia=idx[i]*3,ib=idx[i+1]*3,ic=idx[i+2]*3;
  const ax=pos[ib]-pos[ia],ay=pos[ib+1]-pos[ia+1],az=pos[ib+2]-pos[ia+2];
  const bx=pos[ic]-pos[ia],by=pos[ic+1]-pos[ia+1],bz=pos[ic+2]-pos[ia+2];
  const nx=ay*bz-az*by,ny=az*bx-ax*bz,nz=ax*by-ay*bx;
  for(const q of [ia,ib,ic]){normals[q]+=nx;normals[q+1]+=ny;normals[q+2]+=nz;}
 }
 for(let i=0;i<normals.length;i+=3){const l=Math.hypot(normals[i],normals[i+1],normals[i+2])||1;normals[i]/=l;normals[i+1]/=l;normals[i+2]/=l;}
 const colors=new Array((pos.length/3)*4);for(let i=0;i<colors.length;i+=4)colors.splice(i,4,...color);
 const m=new pc.Mesh(app.graphicsDevice);m.setPositions(new Float32Array(pos));m.setNormals(new Float32Array(normals));m.setColors(new Float32Array(colors),4);m.setIndices(idx);m.update(pc.PRIMITIVE_TRIANGLES);
 const mat=new pc.StandardMaterial();mat.diffuse.set(1,1,1);mat.diffuseVertexColor=true;mat.specular.set(0.03,0.03,0.03);mat.gloss=.05;mat.update();
 return new pc.MeshInstance(m,mat);
}
export function createTrees(app,count=220){
 const trunks=[],ti=[],leaves=[],li=[];
 for(let i=0;i<count;i++){
  const y=1-2*(i+.5)/count, r=Math.sqrt(Math.max(0,1-y*y)), a=i*(Math.PI*(3-Math.sqrt(5)))+rnd(i)*.35;
  const d=norm(Math.cos(a)*r,y,Math.sin(a)*r),t=terrainAt({x:d[0],y:d[1],z:d[2]});
  if(!t.isLand||t.landElevation>.62||t.mountainMask>.72)continue;
  const h=.022+rnd(i+4)*.018, baseR=.0035+rnd(i+9)*.0025, base=[d[0]*(t.height+.001),d[1]*(t.height+.001),d[2]*(t.height+.001)];
  addTrunk(trunks,ti,base,d,h,baseR,5);
  const top=base.map((v,k)=>v+d[k]*h);addCone(leaves,li,top,d,h*.95,baseR*3.2,6);
 }
 return [mesh(app,trunks,ti,[.30,.18,.08,1]),mesh(app,leaves,li,[.10,.32,.12,1])];
}