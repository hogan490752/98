import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

const data=JSON.parse(await fs.readFile(new URL('./realism-assets/mannequins.json',import.meta.url),'utf8'));
const binary=Buffer.from(data.glb,'base64');
const asset=await new GLTFLoader().parseAsync(binary.buffer.slice(binary.byteOffset,binary.byteOffset+binary.byteLength),'');
const people=asset.scene.children;assert.equal(people.length,14);
asset.scene.updateMatrixWorld(true);
const count={},heights={};
for(const person of people){
  const {height_m:h,room,pose}=person.userData;
  count[room]=(count[room]||0)+1;heights[h]=(heights[h]||0)+1;
  const scale=person.getWorldScale(new THREE.Vector3());
  assert.ok([scale.x,scale.y,scale.z].every(value=>Math.abs(value-1)<1e-6));
  const points=[];
  person.traverse(mesh=>{if(!mesh.isMesh)return;
    const positions=mesh.geometry.attributes.position;
    for(let i=0;i<positions.count;i++)points.push(new THREE.Vector3().fromBufferAttribute(positions,i).applyMatrix4(mesh.matrixWorld));
  });
  // 从导出后的实际顶点测量，不仅检查身高标签。
  if(pose!=='seated'){
    const axis=new THREE.Vector3(0,1,0).transformDirection(person.matrixWorld);
    const values=points.map(point=>point.dot(axis));
    assert.ok(Math.abs(Math.max(...values)-Math.min(...values)-h)<1e-5,person.name);
  }
  const joints=JSON.parse(person.userData.joint_positions);
  const world=p=>new THREE.Vector3(p[0],p[2],-p[1]).applyMatrix4(person.matrixWorld);
  for(const side of Object.values(joints))for(const [a,b,ratio] of [['hip','knee',.244],['knee','ankle',.242],['shoulder','elbow',.186],['elbow','wrist',.146]]){
    assert.ok(Math.abs(world(side[a]).distanceTo(world(side[b]))-h*ratio)<1e-5);
  }
}
assert.deepEqual(count,{dining:4,living:2,master:2,'bedroom-south':1,'bedroom-north':1,'bath-west':1,'bath-east':1,kitchen:2});
assert.deepEqual(heights,{'1.7':7,'1.6':7});
console.log('LIVE_GLTF_VERIFIED',{people:people.length,heights,actualGeometry:'standing and lying lengths verified',boneLengths:'verified'});
