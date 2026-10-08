import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";
import { createPlanet } from "./world/Planet.js";
import { createOcean } from "./world/Ocean.js";
import { createStars } from "./environment/Stars.js";
import { attachCameraControls } from "./camera/CameraController.js";

const scene=new THREE.Scene();
scene.background=new THREE.Color(0x000308);
const camera=new THREE.PerspectiveCamera(45,innerWidth/innerHeight,0.1,1000);
camera.position.set(0,0.05,4.25);

const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:"high-performance"});
renderer.setSize(innerWidth,innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.08;
document.body.appendChild(renderer.domElement);

const planet=createPlanet(128);
const ocean=createOcean();
const stars=createStars();
scene.add(planet,ocean.mesh,stars.mesh);

scene.add(new THREE.AmbientLight(0xb8c7d6,0.72));
scene.add(new THREE.HemisphereLight(0xdbeeff,0x26333d,0.34));

const target=new THREE.Vector3();
const controls=attachCameraControls(renderer,camera,target,planet,ocean.mesh);

function animate(){
    requestAnimationFrame(animate);
    if(!controls.dragging) planet.rotation.y+=0.0018;
    ocean.mesh.rotation.y=planet.rotation.y;
    stars.material.opacity=0.45+Math.sin(performance.now()*0.0015)*0.06;
    controls.update();
    renderer.render(scene,camera);
}
animate();

addEventListener("resize",()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
