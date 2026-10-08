import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";

export function createOcean() {
    const geometry=new THREE.SphereGeometry(1.003,192,128);
    const material=new THREE.MeshStandardMaterial({color:0x04435f,roughness:0.78,metalness:0});
    return { mesh:new THREE.Mesh(geometry,material), material };
}
