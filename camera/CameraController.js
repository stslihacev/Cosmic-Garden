import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";

export function attachCameraControls(renderer,camera,target,planet,ocean){
    const state={value:4.25,target:4.25};
    renderer.domElement.addEventListener("wheel",e=>{e.preventDefault();state.target=THREE.MathUtils.clamp(state.target+e.deltaY*0.0028,1.18,5.4)},{passive:false});
    let dragging=false,previousX=0;
    renderer.domElement.addEventListener("mousedown",e=>{if(e.button!==0)return;dragging=true;previousX=e.clientX;});
    window.addEventListener("mousemove",e=>{if(!dragging)return;const dx=e.clientX-previousX;planet.rotation.y+=dx*0.005;ocean.rotation.y=planet.rotation.y;previousX=e.clientX;});
    window.addEventListener("mouseup",()=>dragging=false);
    return {update(){state.value=THREE.MathUtils.lerp(state.value,state.target,0.075);camera.position.set(0,0.05,state.value);camera.lookAt(target);}};
}
