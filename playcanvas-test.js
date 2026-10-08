import * as pc from "playcanvas";
import { createPlanet } from "./playcanvas/Planet.js";
import { createOcean } from "./playcanvas/Ocean.js";

import { attachCameraControls } from "./playcanvas/CameraController.js";

const canvas=document.getElementById("application");
const loading=document.getElementById("loading");

const app=new pc.Application(canvas);
app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
app.setCanvasResolution(pc.RESOLUTION_AUTO);
app.scene.ambientLight = new pc.Color(0.55,0.58,0.64);
app.start();
window.addEventListener("resize",()=>app.resizeCanvas());

const camera=new pc.Entity("Camera");
camera.addComponent("camera",{clearColor:new pc.Color(0.005,0.009,0.016),fov:42,nearClip:0.05,farClip:200});
camera.setPosition(0,0.05,4.25);
app.root.addChild(camera);

const light=new pc.Entity("Sun");
light.addComponent("light",{type:"directional",color:new pc.Color(1,0.94,0.82),intensity:0.8,castShadows:false});
light.setEulerAngles(28,-35,0);
app.root.addChild(light);

const fill=new pc.Entity("FillLight");
fill.addComponent("light",{type:"directional",color:new pc.Color(0.45,0.62,1),intensity:0.5,castShadows:false});
fill.setEulerAngles(-35,145,0);
app.root.addChild(fill);
const fill2=new pc.Entity("AmbientFill");
fill2.addComponent("light",{type:"omni",color:new pc.Color(0.22,0.28,0.38),intensity:0.18,range:20,castShadows:false});
fill2.setPosition(0,0,4);
app.root.addChild(fill2);


const planet=createPlanet(app,128);
const ocean=createOcean(app);


const planetEntity=new pc.Entity("Planet");
planetEntity.addComponent("render",{meshInstances:[planet.meshInstance]});
app.root.addChild(planetEntity);

const oceanEntity=new pc.Entity("Ocean");
oceanEntity.addComponent("render",{meshInstances:[ocean.meshInstance]});
app.root.addChild(oceanEntity);


const controls=attachCameraControls(canvas,camera,planetEntity,oceanEntity);
loading.textContent="PlayCanvas • procedural planet";

app.on("update",dt=>{
    controls.update();
    if(!controls.dragging){
        planetEntity.rotate(0,10*dt,0);
        oceanEntity.setEulerAngles(planetEntity.getEulerAngles());
    }
});