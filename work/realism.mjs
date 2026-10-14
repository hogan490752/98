import * as THREE from 'three';
import {HDRLoader} from 'three/addons/loaders/HDRLoader.js';
import geometryData from './realism-assets/architecture.json';
import indirectData from './realism-assets/indirect.json';
import roomData from './realism-assets/room-environment.json';
import outsideData from './realism-assets/outside.json';

export function decodeBinary(base64){return Uint8Array.from(atob(base64),char=>char.charCodeAt(0)).buffer;}
function hdrTexture(payload){
  const parsed=new HDRLoader().parse(decodeBinary(payload.hdr));
  const texture=new THREE.DataTexture(parsed.data,parsed.width,parsed.height,THREE.RGBAFormat,parsed.type);
  texture.colorSpace=THREE.LinearSRGBColorSpace;texture.flipY=true;
  texture.minFilter=texture.magFilter=THREE.LinearFilter;texture.generateMipmaps=false;texture.needsUpdate=true;
  return texture;
}
export function createRealism(renderer,interior){
  const lightMap=hdrTexture(indirectData);lightMap.channel=1;
  const room=hdrTexture(roomData);room.mapping=THREE.EquirectangularReflectionMapping;
  const outside=hdrTexture(outsideData);outside.mapping=THREE.EquirectangularReflectionMapping;
  const pmrem=new THREE.PMREMGenerator(renderer),environment=pmrem.fromEquirectangular(room).texture;
  pmrem.dispose();room.dispose();
  interior.installBake(geometryData,lightMap);
  return {lightMap,environment,outside};
}
