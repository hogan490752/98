import fs from 'node:fs/promises';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {buildModel, setDisplayHeight, x, dimensions} from './model.mjs';

const data = await fs.readFile(new URL('../outputs/apartment-shell.glb', import.meta.url));
if (data.readUInt32LE(0) !== 0x46546c67 || data.readUInt32LE(4) !== 2 ||
  data.readUInt32LE(8) !== data.length) throw new Error('Invalid GLB header');
const array = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
const loaded = await new GLTFLoader().parseAsync(array, '');
loaded.scene.updateMatrixWorld(true);
const bounds = new THREE.Box3().setFromObject(loaded.scene);
if (Math.abs(bounds.max.y - 2.9) > 1e-6 || Math.abs(bounds.min.y + .16) > 1e-6)
  throw new Error('GLB vertical bounds mismatch');
let count = 0;
loaded.scene.traverse(object => {
  if (object.isMesh) {
    count++;
    if (![...object.geometry.attributes.position.array].every(Number.isFinite))
      throw new Error(`Non-finite vertices: ${object.name}`);
  }
});
const preview = buildModel();
setDisplayHeight(preview.solids, 1.2);
for (const mesh of preview.solids) {
  if (mesh.visible && mesh.position.y + (mesh.userData.top - mesh.userData.base) * mesh.scale.y / 2 > 1.20001)
    throw new Error('Cutaway height mismatch');
}
setDisplayHeight(preview.solids, 2.9);
if (preview.solids.some(mesh => !mesh.visible || Math.abs(mesh.scale.y - 1) > 1e-6))
  throw new Error('Full height was not restored');
if (Math.abs((x(1065) - .1) - (x(846) + .06) - 3.2) > 1e-8)
  throw new Error('Master bedroom clear width mismatch');
for (const d of dimensions) {
  if (Math.abs(d.b[0] - d.a[0] - d.value) > 1e-8)
    throw new Error(`Annotation mismatch: ${d.name}`);
}
console.log(JSON.stringify({validGLB:true, loadedMeshes:count,
  bounds:{min:bounds.min.toArray(), max:bounds.max.toArray()},
  fullHeightAndCutaway:true, clearWidths:[3.4,3.2]}, null, 2));
