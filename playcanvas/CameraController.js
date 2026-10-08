import * as pc from "playcanvas";
export function attachCameraControls(canvas,camera,planet,ocean){
 const state={distance:4.25,target:4.25};let dragging=false,lastX=0;
 canvas.addEventListener("wheel",e=>{e.preventDefault();state.target=pc.math.clamp(state.target+e.deltaY*.0028,1.18,5.4);},{passive:false});
 canvas.addEventListener("mousedown",e=>{if(e.button===0){dragging=true;lastX=e.clientX;}});
 window.addEventListener("mousemove",e=>{if(!dragging)return;const dx=e.clientX-lastX;planet.rotate(0,dx*.32,0);ocean.setEulerAngles(planet.getEulerAngles());lastX=e.clientX;});
 window.addEventListener("mouseup",()=>dragging=false);
 return {get dragging(){return dragging;},update(){state.distance=pc.math.lerp(state.distance,state.target,.075);camera.setPosition(0,.05,state.distance);camera.lookAt(0,0,0);}};
}