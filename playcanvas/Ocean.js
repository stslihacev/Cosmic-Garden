import * as pc from "playcanvas";
export function createOcean(app){
 const mesh=pc.Mesh.fromGeometry(app.graphicsDevice,new pc.SphereGeometry({radius:1.003,latitudeBands:96,longitudeBands:128}));
 const material=new pc.StandardMaterial();
 material.diffuse.set(.012,.14,.22);material.specular.set(.10,.16,.20);material.gloss=.28;material.update();
 return {mesh,material,meshInstance:new pc.MeshInstance(mesh,material)};
}