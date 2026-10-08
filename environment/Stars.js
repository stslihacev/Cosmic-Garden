import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";

export function createStars(count=1800) {
    const positions=new Float32Array(count*3);
    for(let i=0;i<count;i++){
        const i3=i*3, radius=22+Math.random()*90, theta=Math.random()*Math.PI*2, phi=Math.acos(2*Math.random()-1);
        positions[i3]=radius*Math.sin(phi)*Math.cos(theta);
        positions[i3+1]=radius*Math.sin(phi)*Math.sin(theta);
        positions[i3+2]=radius*Math.cos(phi);
    }
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute("position",new THREE.BufferAttribute(positions,3));
    const material=new THREE.PointsMaterial({color:0xffffff,size:0.022,sizeAttenuation:true,transparent:true,opacity:0.45});
    return {mesh:new THREE.Points(geometry,material),material};
}
