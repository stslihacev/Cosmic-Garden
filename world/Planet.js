import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";
import { mergeVertices } from "https://esm.sh/three@0.180.0/examples/jsm/utils/BufferGeometryUtils.js";
import { terrainAt, terrainColor, fbm, ridgedFbm, smoothstep } from "./Terrain.js";

const colors={
    lowlandColor:new THREE.Color(0x3f7f42), meadowColor:new THREE.Color(0x7d9b51),
    dryColor:new THREE.Color(0xa58f63), rockColor:new THREE.Color(0x77756f), snowColor:new THREE.Color(0xe2e3df)
};

function weldAndFix(geometry){
    const pos=geometry.attributes.position.array, idx=geometry.index.array;
    for(let i=0;i<idx.length;i+=3){
        const ia=idx[i]*3,ib=idx[i+1]*3,ic=idx[i+2]*3;
        const ax=pos[ia],ay=pos[ia+1],az=pos[ia+2], bx=pos[ib],by=pos[ib+1],bz=pos[ib+2], cx=pos[ic],cy=pos[ic+1],cz=pos[ic+2];
        const abx=bx-ax,aby=by-ay,abz=bz-az, acx=cx-ax,acy=cy-ay,acz=cz-az;
        const nx=aby*acz-abz*acy, ny=abz*acx-abx*acz, nz=abx*acy-aby*acx;
        if(nx*(ax+bx+cx)+ny*(ay+by+cy)+nz*(az+bz+cz)<0){ const t=idx[i+1];idx[i+1]=idx[i+2];idx[i+2]=t; }
    }
    geometry.setIndex(idx);
    const welded=mergeVertices(geometry,1e-4);
    welded.computeVertexNormals();
    return welded;
}

function markContinent(geometry){
    const pos=geometry.attributes.position;
    const idx=geometry.index;
    const count=pos.count;
    const parent=new Int32Array(count), size=new Int32Array(count);
    const land=new Uint8Array(count);
    for(let i=0;i<count;i++){parent[i]=i;size[i]=1;const d=new THREE.Vector3().fromBufferAttribute(pos,i).normalize();land[i]=terrainAt(d).isLand?1:0;}
    const rootOf=i=>{let r=i;while(parent[r]!==r)r=parent[r];while(parent[i]!==i){const n=parent[i];parent[i]=r;i=n;}return r;};
    const union=(a,b)=>{if(!land[a]||!land[b])return;let ra=rootOf(a),rb=rootOf(b);if(ra===rb)return;if(size[ra]<size[rb])[ra,rb]=[rb,ra];parent[rb]=ra;size[ra]+=size[rb];};
    for(let i=0;i<idx.count;i+=3){const a=idx.getX(i),b=idx.getX(i+1),c=idx.getX(i+2);if(land[a]&&land[b]&&land[c]){union(a,b);union(b,c);}}
    const view=new THREE.Vector3(0,0.05,1).normalize(); let best=-1,bestScore=-Infinity;
    for(let i=0;i<count;i++){if(!land[i]||rootOf(i)!==i||size[i]<100)continue;const d=new THREE.Vector3().fromBufferAttribute(pos,i).normalize();const score=d.dot(view)+Math.min(size[i]/100000,0.5);if(score>bestScore){bestScore=score;best=i;}}
    if(best<0)return;
    const color=geometry.getAttribute("color");
    for(let i=0;i<count;i++) if(land[i]&&rootOf(i)===best){color.setXYZ(i,1,0.25,0.02);}
    color.needsUpdate=true;
}

export function createPlanet(resolution=128){
    const positions=[], colorsArray=[], indices=[];
    function addFace(face){
        const base=positions.length/3;
        for(let row=0;row<=resolution;row++)for(let col=0;col<=resolution;col++){
            const u=col/resolution,v=row/resolution,a=u*2-1,b=v*2-1;
            let cx=0,cy=0,cz=0;
            if(face==="px"){cx=1;cy=b;cz=-a} if(face==="nx"){cx=-1;cy=b;cz=a}
            if(face==="py"){cx=a;cy=1;cz=b} if(face==="ny"){cx=a;cy=-1;cz=-b}
            if(face==="pz"){cx=a;cy=b;cz=1} if(face==="nz"){cx=-a;cy=b;cz=-1}
            const l=Math.hypot(cx,cy,cz),d=new THREE.Vector3(cx/l,cy/l,cz/l),t=terrainAt(d),r=t.height;
            positions.push(d.x*r,d.y*r,d.z*r);
            const c=terrainColor(t,colors);colorsArray.push(c.r,c.g,c.b);
        }
        const rs=resolution+1;
        for(let row=0;row<resolution;row++)for(let col=0;col<resolution;col++){const a=base+row*rs+col,b=a+1,c=a+rs,d=c+1;indices.push(a,c,b,b,c,d);}
    }
    ["px","nx","py","ny","pz","nz"].forEach(addFace);
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute("position",new THREE.Float32BufferAttribute(positions,3));
    geometry.setAttribute("color",new THREE.Float32BufferAttribute(colorsArray,3));
    geometry.setIndex(indices);
    const welded=weldAndFix(geometry);
    // Temporarily disabled during the architecture refactor.\n    // The connected-continent pass is moved to a dedicated lightweight system\n    // so it cannot block the first render.\n
    const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:0.86,metalness:0,side:THREE.FrontSide});
    return new THREE.Mesh(welded,material);
}
