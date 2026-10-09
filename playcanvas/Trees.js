import * as pc from "playcanvas";
import { terrainAt } from "./Terrain.js";

const SEED=1337;
function rnd(i){const x=Math.sin(i*12.9898+SEED)*43758.5453;return x-Math.floor(x);}
function norm(x,y,z){const l=Math.hypot(x,y,z)||1;return [x/l,y/l,z/l];}
function addTri(pos,idx,a,b,c){const n=pos.length/3;pos.push(...a,...b,...c);idx.push(n,n+1,n+2);}
function basis(n){
 const [nx,ny,nz]=n;let tx,ty,tz;
 if(Math.abs(ny)<.9){tx=-nz;ty=0;tz=nx;}else{tx=-ny;ty=nx;tz=0;}
 const tl=Math.hypot(tx,ty,tz)||1;tx/=tl;ty/=tl;tz/=tl;
 return [[tx,ty,tz],[ny*tz-nz*ty,nz*tx-nx*tz,nx*ty-ny*tx]];
}
function addCone(pos,idx,center,n,height,radius,sides=7){
 const [t,b]=basis(n),base=center.map((v,i)=>v+n[i]*height*.20),top=center.map((v,i)=>v+n[i]*height);
 const ring=[];
 for(let j=0;j<sides;j++){const a=j/sides*Math.PI*2;ring.push(base.map((v,k)=>v+(t[k]*Math.cos(a)+b[k]*Math.sin(a))*radius));}
 for(let j=0;j<sides;j++)addTri(pos,idx,ring[j],ring[(j+1)%sides],top);
}
function addTrunk(pos,idx,center,n,height,radius,sides=5){
 const [t,b]=basis(n),top=center.map((v,i)=>v+n[i]*height),lo=[],hi=[];
 for(let j=0;j<sides;j++){const a=j/sides*Math.PI*2,off=t.map((v,k)=>v*Math.cos(a)+b[k]*Math.sin(a));lo.push(center.map((v,k)=>v+off[k]*radius));hi.push(top.map((v,k)=>v+off[k]*radius*.72));}
 for(let j=0;j<sides;j++){const k=(j+1)%sides;addTri(pos,idx,lo[j],hi[j],lo[k]);addTri(pos,idx,lo[k],hi[j],hi[k]);}
}
function addLeafCluster(pos,idx,center,n,rx,ry,rz){
 const [t,b]=basis(n);
 const points=[
  center.map((v,k)=>v+n[k]*ry),
  center.map((v,k)=>v-n[k]*ry),
  center.map((v,k)=>v+t[k]*rx),
  center.map((v,k)=>v-t[k]*rx),
  center.map((v,k)=>v+b[k]*rz),
  center.map((v,k)=>v-b[k]*rz)
 ];
 for(const tri of [[0,2,4],[0,4,3],[0,3,5],[0,5,2],[1,4,2],[1,3,4],[1,5,3],[1,2,5]]){
  addTri(pos,idx,points[tri[0]],points[tri[1]],points[tri[2]]);
 }
}
function makeMesh(app,pos,idx,color){
 if(!pos.length)return null;
 const normals=new Float32Array(pos.length);
 for(let i=0;i<idx.length;i+=3){
  const ia=idx[i]*3,ib=idx[i+1]*3,ic=idx[i+2]*3;
  const ax=pos[ib]-pos[ia],ay=pos[ib+1]-pos[ia+1],az=pos[ib+2]-pos[ia+2];
  const bx=pos[ic]-pos[ia],by=pos[ic+1]-pos[ia+1],bz=pos[ic+2]-pos[ia+2];
  const n=[ay*bz-az*by,az*bx-ax*bz,ax*by-ay*bx];
  for(const q of [ia,ib,ic]){normals[q]=n[0];normals[q+1]=n[1];normals[q+2]=n[2];}
 }
 for(let i=0;i<normals.length;i+=3){const l=Math.hypot(normals[i],normals[i+1],normals[i+2])||1;normals[i]/=l;normals[i+1]/=l;normals[i+2]/=l;}
 const colors=new Float32Array((pos.length/3)*4);
 for(let i=0;i<colors.length;i+=4){colors[i]=color[0];colors[i+1]=color[1];colors[i+2]=color[2];colors[i+3]=1;}
 const m=new pc.Mesh(app.graphicsDevice);m.setPositions(new Float32Array(pos));m.setNormals(normals);m.setColors(colors,4);m.setIndices(idx);m.update(pc.PRIMITIVE_TRIANGLES);
 const mat=new pc.StandardMaterial();mat.diffuse.set(1,1,1);mat.diffuseVertexColor=true;mat.specular.set(.025,.025,.025);mat.gloss=.04;mat.update();
 return new pc.MeshInstance(m,mat);
}
function treeBase(d,t){
 const radius=Math.max(t.height,1.007)+.0025;
 return d.map(v=>v*radius);
}
function makeSnowLayer(app){
 const PHI=(1+Math.sqrt(5))/2;
 const vertices=[[-1,PHI,0],[1,PHI,0],[-1,-PHI,0],[1,-PHI,0],[0,-1,PHI],[0,1,PHI],[0,-1,-PHI],[0,1,-PHI],[PHI,0,-1],[PHI,0,1],[-PHI,0,-1],[-PHI,0,1]].map(v=>norm(...v));
 let faces=[[0,11,5],[0,5,1],[0,1,7],[0,7,10],[0,10,11],[1,5,9],[5,11,4],[11,10,2],[10,7,6],[7,1,8],[3,9,4],[3,4,2],[3,2,6],[3,6,8],[3,8,9],[4,9,5],[2,4,11],[6,2,10],[8,6,7],[9,8,1]];
 for(let s=0;s<6;s++){
  const cache=new Map(),next=[];
  const get=(a,b)=>{const key=a<b?a+","+b:b+","+a;if(cache.has(key))return cache.get(key);const v=norm(vertices[a][0]+vertices[b][0],vertices[a][1]+vertices[b][1],vertices[a][2]+vertices[b][2]);const id=vertices.length;vertices.push(v);cache.set(key,id);return id;};
  for(const [a,b,c] of faces){const ab=get(a,b),bc=get(b,c),ca=get(c,a);next.push([a,ab,ca],[b,bc,ab],[c,ca,bc],[ab,bc,ca]);}
  faces=next;
 }
 const pos=[],idx=[];
 for(const f of faces){
  const dirs=f.map(i=>vertices[i]),ts=dirs.map(d=>terrainAt({x:d[0],y:d[1],z:d[2]}));
  // Snow forms a continuous second surface on cold high-latitude land,
  // with natural coastlines rather than scattered white dots.
  if(!dirs.every((d,i)=>ts[i].isLand&&Math.abs(d[1])>.70))continue;
  const start=pos.length/3;
  for(let j=0;j<3;j++){
   const d=dirs[j],t=ts[j];
   const relief=((t.detail??.5)-.5)*.007+((t.micro??.5)-.5)*.003+((t.grain??.5)-.5)*.001;
   const radius=Math.max(t.height+relief,1.007)+.004;
   pos.push(d[0]*radius,d[1]*radius,d[2]*radius);
  }
  idx.push(start,start+1,start+2);
 }
 return makeMesh(app,pos,idx,[.78,.87,.94]);
}
export function createTrees(app,count=5200){
 const trunkPos=[],trunkIdx=[];
 const pine={pos:[],idx:[]};
 const broadleaf=[{pos:[],idx:[],color:[.055,.24,.095]},{pos:[],idx:[],color:[.12,.34,.12]},{pos:[],idx:[],color:[.20,.39,.14]}];
 const grass=[{pos:[],idx:[],color:[.22,.43,.13]},{pos:[],idx:[],color:[.36,.51,.18]},{pos:[],idx:[],color:[.15,.32,.10]}];
 for(let i=0;i<count;i++){
  const y=1-2*(i+.5)/count,r=Math.sqrt(Math.max(0,1-y*y)),a=i*(Math.PI*(3-Math.sqrt(5)))+(rnd(i)-.5)*.48;
  const d=norm(Math.cos(a)*r,y,Math.sin(a)*r),t=terrainAt({x:d[0],y:d[1],z:d[2]});
  if(!t.isLand||t.landElevation>.66||t.mountainMask>.57)continue;
  const cold=Math.abs(d[1])>.70;
  const patch=rnd(Math.floor(i/6)+100);
  const base=treeBase(d,t);
  // Grass: many tiny crossed blades, combined into a few meshes to keep draw calls low.
  if(!cold&&t.moisture>.28&&patch>.12&&rnd(i+701)>.24){
   const bladeCount=2+(rnd(i+702)>.55?1:0),[tan,bitan]=basis(d);
   for(let k=0;k<bladeCount;k++){
    const ang=rnd(i*5+k+703)*Math.PI*2;
    const dir=tan.map((v,j)=>v*Math.cos(ang)+bitan[j]*Math.sin(ang));
    const side=tan.map((v,j)=>v*Math.cos(ang+1.57)+bitan[j]*Math.sin(ang+1.57));
    const h=.003+rnd(i*3+k+704)*.006,w=.00065+rnd(i+k+705)*.00045;
    const root=base.map((v,j)=>v+d[j]*.0004);
    const tip=root.map((v,j)=>v+d[j]*h+dir[j]*h*.18);
    const left=root.map((v,j)=>v+side[j]*w),right=root.map((v,j)=>v-side[j]*w);
    const g=grass[Math.floor(rnd(i+k+706)*grass.length)];
    addTri(g.pos,g.idx,left,right,tip);
   }
  }
  if(cold||patch<.25||rnd(i+10)<.25)continue;
  const h=.018+rnd(i+4)*.026,tr=.0009+rnd(i+9)*.0012;
  const kind=rnd(i+23);
  if(kind<.43){
   // Conifers: irregular layered branches, not a single plain cone.
   addTrunk(trunkPos,trunkIdx,base,d,h*.72,tr,5);
   for(let tier=0;tier<4;tier++){
    const center=base.map((v,k)=>v+d[k]*(h*(.20+tier*.17)));
    const tierH=h*(.43-tier*.045),radius=h*(.25-tier*.035);
    addCone(pine.pos,pine.idx,center,d,tierH,radius,7);
   }
  }else{
   // Broadleaf trees: visible trunk and branches supporting clustered crowns.
   addTrunk(trunkPos,trunkIdx,base,d,h*.72,tr,5);
   const crown=base.map((v,k)=>v+d[k]*h*.60);
   const leaf=broadleaf[Math.floor(rnd(i+24)*broadleaf.length)];
   addLeafCluster(leaf.pos,leaf.idx,crown,d,h*.22,h*.29,h*.22);
   for(let branch=0;branch<3;branch++){
    const ang=rnd(i*4+branch+25)*Math.PI*2,[tan,bitan]=basis(d);
    const dir=tan.map((v,k)=>v*Math.cos(ang)+bitan[k]*Math.sin(ang));
    const c=crown.map((v,k)=>v+d[k]*h*.08+dir[k]*h*.13);
    addLeafCluster(leaf.pos,leaf.idx,c,d,h*.16,h*.19,h*.16);
   }
  }
 }
 const result=[];
 const trunk=makeMesh(app,trunkPos,trunkIdx,[.25,.15,.075]);if(trunk)result.push(trunk);
 const conifers=makeMesh(app,pine.pos,pine.idx,[.075,.27,.105]);if(conifers)result.push(conifers);
 for(const f of broadleaf){const m=makeMesh(app,f.pos,f.idx,f.color);if(m)result.push(m);}
 for(const g of grass){const m=makeMesh(app,g.pos,g.idx,g.color);if(m)result.push(m);}
 const snow=makeSnowLayer(app);if(snow)result.push(snow);
 return result;
}
