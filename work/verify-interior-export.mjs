import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {buildModel,x,z} from './model.mjs';

const bytes=await fs.readFile(new URL('../outputs/暖木现代-装修模型.glb',import.meta.url));
assert.equal(bytes.readUInt32LE(0),0x46546c67);
assert.equal(bytes.readUInt32LE(4),2);
assert.equal(bytes.readUInt32LE(8),bytes.length);
const jsonSize=bytes.readUInt32LE(12),json=JSON.parse(bytes.subarray(20,20+jsonSize).toString());
assert(json.images.length>0&&json.images.every(image=>Number.isInteger(image.bufferView)&&!image.uri),'贴图必须全部嵌入');
assert(json.buffers.every(buffer=>!buffer.uri),'几何缓冲不得依赖外部文件');
const binaryStart=28+jsonSize;
for(const view of json.bufferViews)assert((view.byteOffset||0)+view.byteLength<=bytes.length-binaryStart);
// Node 中验证真实几何重导入；嵌入图片由 Python/Pillow 独立解码验证。
const loader=new GLTFLoader();
loader.register(()=>({name:'Verify_Textures',loadTexture(){return Promise.resolve(new THREE.Texture());}}));
const array=bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);
const loaded=await loader.parseAsync(array,'');loaded.scene.updateMatrixWorld(true);
let meshCount=0,furnitureCount=0,slidingDoors=0;
const wetWalls=[];
loaded.scene.traverse(item=>{
  if(item.userData.editable)furnitureCount++;
  if(item.userData.doorType==='sliding-glass')slidingDoors++;
  if(!item.isMesh)return;meshCount++;
  assert([...item.geometry.attributes.position.array].every(Number.isFinite),'顶点必须有限');
  if(item.material.name==='装修_wetWall')wetWalls.push(item);
  if(['装修_tile','装修_wetWall'].includes(item.material.name)){
    const positions=item.geometry.attributes.position;
    for(let i=0;i<positions.count;i++){
      const p=new THREE.Vector3().fromBufferAttribute(positions,i).applyMatrix4(item.matrixWorld);
      assert(!(p.y>.20&&p.x>x(526)+.06&&p.x<x(695)-.10&&p.z>z(276)+.06&&p.z<z(431)-.06),
        '卫浴墙面饰面不能侵入厨房');
    }
  }
  if(Number.isFinite(item.userData.top)){
    assert.equal(item.scale.y,1,'导出墙体必须为完整高度');
    assert(Math.abs(item.position.y-(item.userData.base+item.userData.top)/2)<1e-6);
  }
});
const bounds=new THREE.Box3().setFromObject(loaded.scene);
assert(Math.abs(bounds.max.y-3.06)<1e-6,'2.90 米顶面以上保留 0.16 米示意顶板');
assert.equal(furnitureCount,26);
assert.equal(slidingDoors,1,'厨房应导出一扇推拉玻璃门');
const bathWindows=buildModel().openings.filter(h=>h.wall==='Exterior_Rooms_North'&&h.kind==='window'&&
  ((h.start>x(695)&&h.end<x(773))||h.start>x(951)));
assert.equal(bathWindows.length,2);
for(const window of bathWindows){
  const ray=new THREE.Raycaster(new THREE.Vector3((window.start+window.end)/2,(window.sill+window.top)/2,window.fixed+.40),
    new THREE.Vector3(0,0,-1),0,.60);
  assert.equal(ray.intersectObjects(wetWalls,false).length,0,'卫生间窗洞不能被墙面饰面封住');
}
let fridge;
loaded.scene.traverse(item=>{if(item.userData.id==='fridge')fridge=item;});
assert(fridge&&fridge.userData.editable,'冰箱必须作为可调整家具导出');
assert.equal(fridge.userData.doorStyle,'side-by-side','冰箱应为左右双开门');
assert(Math.abs(new THREE.Box3().setFromObject(fridge).max.x-(x(430)+.10))<1e-6,'冰箱门面必须与相邻墙面齐平');
assert(fridge.position.x<.25&&fridge.position.z>4.5&&fridge.position.z<5.7,'冰箱位于外凸凹位');
console.log(JSON.stringify({validGLB:true,embeddedImages:json.images.length,reimportedMeshes:meshCount,
  editableFurniture:furnitureCount,fullHeight:true,bytes:bytes.length},null,2));
