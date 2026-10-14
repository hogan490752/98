import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {HDRLoader} from 'three/addons/loaders/HDRLoader.js';
import {buildModel} from './model.mjs';

const data=JSON.parse(await fs.readFile(new URL('./realism-assets/architecture.json',import.meta.url),'utf8'));
const model=buildModel();
let count=0;
for(const mesh of [...model.solids,model.slab]){
  const entry=data[mesh.name];assert(entry,'缺少烘焙结构：'+mesh.name);
  for(const name of ['position','normal','uv','uv1'])assert(entry[name].every(Number.isFinite));
  assert.equal(entry.position.length,entry.normal.length);
  assert.equal(entry.uv1.length/2,entry.position.length/3);
  assert(entry.uv1.every(value=>value>=-1e-6&&value<=1.000001),'光照UV超出图集');
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(entry.position,3));geometry.computeBoundingBox();
  mesh.geometry.computeBoundingBox();
  assert(geometry.boundingBox.min.distanceTo(mesh.geometry.boundingBox.min)<1e-5,mesh.name+'底部边界改变');
  assert(geometry.boundingBox.max.distanceTo(mesh.geometry.boundingBox.max)<1e-5,mesh.name+'顶部边界改变');count++;
}
for(const name of ['indirect','room-environment','outside']){
  const payload=JSON.parse(await fs.readFile(new URL('./realism-assets/'+name+'.json',import.meta.url),'utf8'));
  const bytes=Buffer.from(payload.hdr,'base64');
  const hdr=new HDRLoader().parse(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
  assert(hdr.width>=512&&hdr.height>=512);
  assert(hdr.data.some(value=>value>0),'HDR不能为空');
}
console.log(JSON.stringify({unchangedStructureBounds:count,bakeUV:true,hdrAssets:3},null,2));
