import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {PointerLockControls} from 'three/addons/controls/PointerLockControls.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {SSAOPass} from 'three/addons/postprocessing/SSAOPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {buildModel, setDisplayHeight, dimensions, x, z} from './model.mjs';
import {createWalkWorld, moveWithCollisions, canStand, person} from './walk.mjs';
import {areaReport, findAreaZone, displayedSpaces} from './areas.mjs';
import {createInterior,roomViews} from './interior.mjs';
import {mountStudio} from './studio-ui.mjs';
import {createRealism} from './realism.mjs';

const container = document.getElementById('view');
const canvas = document.getElementById('scene');
const status = document.getElementById('status');
const areaHUD = document.getElementById('current-area');
document.getElementById('panorama-open').addEventListener('click',()=>{
  const room=roomViews.some(p=>p.id===areaHUD.dataset.areaId)?areaHUD.dataset.areaId:'living';
  location.href='apartment-panorama.html?v=people-16#'+window.shellViewer.interior.theme+'/'+room;
});
const areaRows = document.getElementById('area-rows');
displayedSpaces.forEach(space => {
  const row = document.createElement('tr');
  row.dataset.areaId = space.id;
  [space.name, space.netDisplay.toFixed(2)].forEach((value,i) => {
    const cell = document.createElement(i === 0 ? 'th' : 'td');
    if (i === 0) cell.scope = 'row';
    cell.textContent = value;
    row.appendChild(cell);
  });
  areaRows.appendChild(row);
});
document.getElementById('net-total').textContent = areaReport.netDisplayTotal.toFixed(2);
document.getElementById('wall-total').textContent = areaReport.wallDisplay.toFixed(2);
document.getElementById('area-caption').textContent =
  `模型按98㎡总面积作示意校准。外墙200mm、内墙120mm均是假定值，墙体及房间面积不是实测数据。`;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xeae7e1);
const camera = new THREE.PerspectiveCamera(36, 1, .1, 100);
const renderer = new THREE.WebGLRenderer({canvas, antialias:true, preserveDrawingBuffer:true});
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true;
renderer.localClippingEnabled=true;
const displayClip=new THREE.Plane(new THREE.Vector3(0,-1,0),1.2);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.3;
const environmentScene=new RoomEnvironment();
const pmrem=new THREE.PMREMGenerator(renderer);
scene.environment=pmrem.fromScene(environmentScene,.04).texture;
scene.environmentIntensity=.55;
pmrem.dispose();environmentScene.dispose();
const controls = new OrbitControls(camera, canvas);
const mouseLook = new PointerLockControls(camera, canvas);
mouseLook.minPolarAngle = .15;
mouseLook.maxPolarAngle = Math.PI - .15;
mouseLook.pointerSpeed = .85;
controls.enableDamping = true;
controls.minDistance = 5;
controls.maxDistance = 40;
controls.maxPolarAngle = Math.PI / 2 - .02;
controls.target.set(4.35, .2, 6.05);

const hemisphere=new THREE.HemisphereLight(0xffffff,0xb9bcb0,.75);scene.add(hemisphere);
const sun = new THREE.DirectionalLight(0xfff6e7, 3.2);
sun.position.set(-3,8,22);
sun.target.position.set(3.3,0,8.8);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, {left:-12, right:12, top:14, bottom:-14, near:.5, far:50});
sun.shadow.normalBias = .015;
sun.shadow.radius=4;
scene.add(sun, sun.target);
const fill = new THREE.DirectionalLight(0xffffff, .8);
fill.position.set(15, 10, 14);
scene.add(fill);

const model = buildModel({edges:true});
scene.add(model.root);
const walkWorld = createWalkWorld(model);

// 漫游补上顶面和细微水泥肌理；不改变导出的墙体尺寸。
function concreteTexture(repeatX, repeatY) {
  const tile = document.createElement('canvas');
  tile.width = tile.height = 256;
  const ctx = tile.getContext('2d');
  const pixels = ctx.createImageData(256, 256);
  let seed = 20261012;
  for (let i = 0; i < pixels.data.length; i += 4) {
    seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
    const shade = 208 + ((seed >>> 24) % 33);
    pixels.data.set([shade, shade, shade - 3, 255], i);
  }
  ctx.putImageData(pixels, 0, 0);
  const texture = new THREE.CanvasTexture(tile);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeatX, repeatY);
  texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  return texture;
}
const wallTexture = concreteTexture(3, 2);
const seenMaterials = new Set();
model.solids.forEach(mesh => {
  if (seenMaterials.has(mesh.material)) return;
  seenMaterials.add(mesh.material);
  mesh.material.map = wallTexture;
  mesh.material.bumpMap = wallTexture;
  mesh.material.bumpScale = .018;
  mesh.material.needsUpdate = true;
});
model.slab.material.map = concreteTexture(12, 15);
model.slab.material.color.setHex(0x96968e);
const ceiling = new THREE.Mesh(model.slab.geometry.clone(),
  new THREE.MeshStandardMaterial({color:0xbab8af, map:concreteTexture(10, 12), roughness:1}));
ceiling.position.y = 3.06;
ceiling.castShadow = true;
ceiling.receiveShadow = true;
scene.add(ceiling);
const interior=createInterior({model,scene,ceiling});
const originalEnvironment=scene.environment;
const realism=createRealism(renderer,interior);
const wallBoxes=walkWorld.boxes.slice();
function refreshColliders(){walkWorld.boxes=wallBoxes.concat(interior.colliders());renderer.shadowMap.needsUpdate=true;}
refreshColliders();
let studio=null,compare=false,compareSplit=.50,night=false,editing=false;
const composer=new EffectComposer(renderer);
composer.addPass(new RenderPass(scene,camera));
const ao=new SSAOPass(scene,camera,512,512,8);
ao.kernelRadius=.14;ao.minDistance=.002;ao.maxDistance=.065;
composer.addPass(ao);composer.addPass(new OutputPass());
const bounds = new THREE.Box3().setFromObject(model.root);
const modelCenter = bounds.getCenter(new THREE.Vector3());
const ground = new THREE.Mesh(new THREE.PlaneGeometry(80, 80),
  new THREE.ShadowMaterial({opacity:.14}));
ground.rotation.x = -Math.PI / 2;
ground.position.set(modelCenter.x, -.17, modelCenter.z);
ground.receiveShadow = true;
scene.add(ground);

const annotations = new THREE.Group();
annotations.name = 'Preview_Annotations';
scene.add(annotations);
function textSprite(text, px, pz, width = 1.3, dimension = false) {
  const image = document.createElement('canvas');
  const ctx = image.getContext('2d');
  const lines = text.split('\n');
  ctx.font = '500 64px "Microsoft YaHei", "PingFang SC", sans-serif';
  image.width = Math.ceil(Math.max(...lines.map(line => ctx.measureText(line).width)) + 32);
  image.height = lines.length === 1 ? 112 : 184;
  ctx.font = '500 64px "Microsoft YaHei", "PingFang SC", sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = dimension ? '#215d50' : '#494842';
  lines.forEach((line,i) => ctx.fillText(line, image.width / 2,
    lines.length === 1 ? image.height / 2 : 53 + i * 76));
  const texture = new THREE.CanvasTexture(image);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({map:texture,
    depthTest:false, transparent:true}));
  sprite.position.set(px, .08, pz);
  sprite.scale.set(width, width * image.height / image.width, 1);
  sprite.renderOrder = 3;
  annotations.add(sprite);
}
areaReport.spaces.forEach(space => {
  const [px,py] = space.anchor;
  const width = space.id.startsWith('bath') || space.id === 'service' ? 1.22 : 1.60;
  textSprite(`${space.label}\n${space.netDisplay.toFixed(2)}㎡`, x(px), z(py), width);
});
const dimensionMaterial = new THREE.LineBasicMaterial({color:0x2c7866, depthTest:false});
dimensions.forEach(d => {
  const [ax, az] = d.a, [bx, bz] = d.b;
  const vertices = [ax,.04,az, bx,.04,bz, ax,.04,az-.09, ax,.04,az+.09,
    bx,.04,bz-.09,bx,.04,bz+.09];
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  const line = new THREE.LineSegments(geometry, dimensionMaterial);
  line.renderOrder = 2;
  annotations.add(line);
  textSprite(`净宽 ${d.value.toFixed(2)} m`, (ax + bx) / 2, az + .34, 2.25, true);
});

let currentView = 'walk';
let walkingActive = false;
let dragging = null;
const pressed = new Set();
const walkOverlay = document.getElementById('walk-overlay');
const walkHint = document.getElementById('walk-hint');
const spawn = new THREE.Vector3(...roomViews[0].position);
function safePosition(position,id) {
  if(canStand(walkWorld,position.x,position.z)) return position;
  for(let radius=.12;radius<1.7;radius+=.12) for(let i=0;i<16;i++) {
    const angle=i*Math.PI/8,px=position.x+Math.cos(angle)*radius,pz=position.z+Math.sin(angle)*radius;
    if(canStand(walkWorld,px,pz)&&(!id||findAreaZone(px,pz).id===id)) return new THREE.Vector3(px,person.eyeHeight,pz);
  }
  return null;
}
function goRoom(id) {
  const room=roomViews.find(item=>item.id===id);if(!room)return false;
  if(currentView!=='walk')fitView('walk');
  const position=safePosition(new THREE.Vector3(...room.position),id);if(!position)return false;
  camera.position.copy(position);camera.lookAt(...room.look);walkingActive=true;
  pressed.clear();syncWalkUI();return true;
}
let lastAreaId = null;
function updateAreaHUD() {
  const zone = findAreaZone(camera.position.x, camera.position.z);
  if (zone.id === lastAreaId) return;
  lastAreaId = zone.id;
  const space = areaReport.spaces.find(item => item.id === zone.id);
  areaHUD.dataset.areaId = space.id;
  areaHUD.textContent = `${space.name} · 地面约 ${space.netDisplay.toFixed(2)}㎡（不含墙体）`;
}
function syncWalkUI() {
  document.body.classList.toggle('walking', currentView === 'walk');
  walkOverlay.hidden = currentView !== 'walk' || walkingActive;
  document.getElementById('crosshair').hidden = currentView !== 'walk' || !walkingActive;
  document.getElementById('help').textContent = currentView === 'walk' ?
    'WASD / 方向键 行走 · 拖动画面转头 · Shift 快走 · Esc 暂停' :
    '拖动旋转 · 滚轮缩放 · 右键拖动平移';
  document.getElementById('height-section').hidden = currentView === 'walk';
  document.getElementById('labels-check').hidden = currentView === 'walk';
  areaHUD.hidden = currentView !== 'walk';
  if (currentView === 'walk') updateAreaHUD();
}
function fitView(view) {
  currentView = view;
  pressed.clear();
  controls.enabled = view !== 'walk';
  mouseLook.enabled = view === 'walk';
  ceiling.visible = view === 'walk';
  annotations.visible = view !== 'walk' && document.getElementById('labels').checked;
  camera.fov = view === 'walk' ? (container.clientWidth<760?82:70) : 36;
  camera.updateProjectionMatrix();
  walkingActive = false;
  if (mouseLook.isLocked) mouseLook.unlock();
  if (view === 'walk') {
    changeHeight(2.9);
    refreshColliders();camera.position.copy(safePosition(spawn.clone(),'living')||spawn);
    camera.lookAt(...roomViews[0].look);walkingActive=true;
  } else {
  changeHeight(1.2);
  const center = new THREE.Vector3(modelCenter.x, view === 'top' ? 0 : .35, modelCenter.z);
  controls.target.copy(center);
  const aspect = container.clientWidth / container.clientHeight;
  const verticalExtent = bounds.max.z - bounds.min.z + 2.4;
  const horizontalExtent = bounds.max.x - bounds.min.x + 1.9;
  const distance = Math.max(verticalExtent, horizontalExtent / aspect) /
    (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
  const direction = view === 'top' ? new THREE.Vector3(0, 1, .001) :
    new THREE.Vector3(0.50, 1.25, 1.15).normalize();
  camera.position.copy(center).addScaledVector(direction, distance * (view === 'top' ? 1.0 : 1.12));
  controls.update();
  }
  syncWalkUI();
  if(studio)studio.syncView(view);
  document.querySelectorAll('[data-view]').forEach(b => {
    b.setAttribute('aria-pressed', String(b.dataset.view === view));
  });
}
function resize() {
  const width = container.clientWidth, height = container.clientHeight;
  renderer.setSize(width, height, false);
  if(currentView==='walk')camera.fov=width<760?82:70;
  composer.setSize(width,height);
  ao.setSize(Math.ceil(width*.65),Math.ceil(height*.65));
  ao.enabled=width>700&&!editing;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}
new ResizeObserver(() => {
  resize();
  if (currentView !== 'walk') fitView(currentView);
}).observe(container);

const heightControl = document.getElementById('height');
const heightValue = document.getElementById('height-value');
function changeHeight(height) {
  setDisplayHeight(model.solids, height);
  // 总览同步剖切饰面、门窗与家具，避免完整窗框和顶灯悬在矮墙上方。
  displayClip.constant=height;
  const clipped=currentView!=='walk'&&height<2.9,materials=new Set();
  interior.group.traverse(item=>{if(item.isMesh){for(const material of Array.isArray(item.material)?item.material:[item.material])materials.add(material);}});
  materials.forEach(material=>{material.clippingPlanes=clipped?[displayClip]:[];material.clipShadows=true;});
  renderer.shadowMap.needsUpdate=true;
  heightControl.value = height;
  heightValue.textContent = `${height.toFixed(2)} 米`;
  document.getElementById('full').setAttribute('aria-pressed', String(height === 2.9));
}
heightControl.addEventListener('input', () => changeHeight(Number(heightControl.value)));
document.getElementById('full').addEventListener('click', () => changeHeight(2.9));
document.getElementById('cutaway').addEventListener('click', () => changeHeight(1.2));
document.querySelectorAll('[data-view]').forEach(b => {
  b.addEventListener('click', () => fitView(b.dataset.view));
});
document.getElementById('labels').addEventListener('change', e => {
  annotations.visible = currentView !== 'walk' && e.target.checked;
});

function pauseWalk() {
  pressed.clear();
  walkingActive = false;
  dragging = null;
  if (mouseLook.isLocked) mouseLook.unlock();
  syncWalkUI();
}
function beginWalk() {
  if (currentView !== 'walk') fitView('walk');
  walkingActive = true;
  syncWalkUI();
  canvas.focus({preventScroll:true});
  walkHint.textContent = 'WASD 行走，鼠标转头；Esc 暂停。';
  // 直接接住浏览器返回的 Promise，嵌入页拒绝锁定时仍可拖动转头。
  try {
    const request = canvas.requestPointerLock?.();
    request?.catch?.(() => {walkHint.textContent = 'WASD 行走，按住鼠标拖动转头。';});
  } catch {
    walkHint.textContent = 'WASD 行走，按住鼠标拖动转头。';
  }
}
mouseLook.addEventListener('unlock', () => {if (currentView === 'walk') pauseWalk();});
document.getElementById('enter-walk').addEventListener('click', beginWalk);
document.getElementById('pause-walk').addEventListener('click', pauseWalk);
document.getElementById('overview-from-pause').addEventListener('click', () => fitView('overview'));
document.getElementById('reset-walk').addEventListener('click', () => fitView('walk'));
document.getElementById('fullscreen').addEventListener('click', async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await (document.getElementById('studio-shell')||container).requestFullscreen();
  } catch {
    walkHint.textContent = '当前预览中可直接漫游；也可以用浏览器打开文件后全屏。';
  }
});

const moveKeys = ['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowLeft','ArrowDown','ArrowRight','ShiftLeft','ShiftRight'];
// 部分浏览器与辅助输入没有 event.code，保留按键名称作为兼容路径。
const keyCode = e => e.code || ({w:'KeyW',a:'KeyA',s:'KeyS',d:'KeyD',shift:'ShiftLeft'}[e.key.toLowerCase()] ?? e.key);
document.addEventListener('keydown', e => {
  if (currentView !== 'walk') return;
  const code = keyCode(e);
  if (code === 'Escape') {pauseWalk(); return;}
  if (!walkingActive || /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
  if (moveKeys.includes(code)) {pressed.add(code); e.preventDefault();}
});
document.addEventListener('keyup', e => pressed.delete(keyCode(e)));
window.addEventListener('blur', pauseWalk);
document.addEventListener('visibilitychange', () => {if (document.hidden) pauseWalk();});
canvas.addEventListener('pointerdown', e => {
  if (currentView !== 'walk' || !walkingActive || mouseLook.isLocked) return;
  dragging = {id:e.pointerId, x:e.clientX, y:e.clientY};
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', e => {
  if (!dragging || dragging.id !== e.pointerId || mouseLook.isLocked) return;
  const angles = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ');
  angles.y -= (e.clientX - dragging.x) * .003;
  angles.x = THREE.MathUtils.clamp(angles.x - (e.clientY - dragging.y) * .003, -1.42, 1.42);
  camera.quaternion.setFromEuler(angles);
  dragging.x = e.clientX; dragging.y = e.clientY;
});
const endDrag = () => {dragging = null;};
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);

function walkFrame(delta) {
  const forwardKey = Number(pressed.has('KeyW') || pressed.has('ArrowUp')) -
    Number(pressed.has('KeyS') || pressed.has('ArrowDown'));
  const sideKey = Number(pressed.has('KeyD') || pressed.has('ArrowRight')) -
    Number(pressed.has('KeyA') || pressed.has('ArrowLeft'));
  if (!forwardKey && !sideKey) return;
  const direction = camera.getWorldDirection(new THREE.Vector3());
  direction.y = 0;
  direction.normalize();
  const right = new THREE.Vector3().crossVectors(direction, camera.up);
  const movement = direction.multiplyScalar(forwardKey).addScaledVector(right, sideKey).normalize();
  const speed = pressed.has('ShiftLeft') || pressed.has('ShiftRight') ? 3.0 : 1.6;
  const next = moveWithCollisions(walkWorld, camera.position, movement.x * speed * delta, movement.z * speed * delta);
  camera.position.set(next.x, person.eyeHeight, next.z);
}

resize();
// 面积交付链接直接定位到俯视标注，普通打开仍从第一人称漫游开始。
fitView(location.hash === '#areas' ? 'top' : 'walk');
window.addEventListener('hashchange', () => {
  if (location.hash === '#areas') fitView('top');
});

window.shellViewer = {
  ready:true, fitView, changeHeight, camera, controls, model, renderer, scene,
  walkWorld, beginWalk, pauseWalk, walkFrame,
  areaReport,
  get mode() {return currentView;},
  get walkingActive() {return walkingActive;},
  verifiedWidths:{living:3.4, master:3.2},
  snapshot() {renderer.render(scene, camera); return canvas.toDataURL('image/png');}
};
status.textContent = '漫游已就绪';
let lastFrame = performance.now();
renderer.setAnimationLoop(now => {
  const delta = Math.min((now - lastFrame) / 1000, .05);
  lastFrame = now;
  if (currentView === 'walk') {
    if (walkingActive&&!editing) walkFrame(delta);
    updateAreaHUD();
  } else controls.update();
  if(interior.update(delta,camera.position,currentView==='walk',night))renderer.shadowMap.needsUpdate=true;
  if(studio)studio.update(now,delta);
  renderScene();
});

function setTime(value) {
  night=value==='night';
  syncLighting();
}
let lastLightingMode='';
function syncLighting(){
  const baked=interior.theme==='warm'&&!night,key=baked?'baked':night?'night':'preview';
  if(key===lastLightingMode)return;lastLightingMode=key;
  hemisphere.intensity=baked?.055:night?.25:.75;
  sun.intensity=baked?2.5:night?.08:2.25;fill.intensity=baked?.025:night?.15:.45;
  scene.background=baked?realism.outside:new THREE.Color(night?0x34484d:0xe7ece9);
  scene.backgroundIntensity=baked?.65:1;
  scene.environment=baked?realism.environment:originalEnvironment;
  scene.environmentRotation.y=baked?-Math.PI/2:0;
  scene.environmentIntensity=baked?3.2:night?.28:.80;
  renderer.toneMappingExposure=baked?1.35:night?1.15:1.03;
}
function renderScene() {
  syncLighting();
  if(compare) {
    const width=container.clientWidth,height=container.clientHeight,split=Math.round(width*compareSplit);
    const before=interior.raw;
    renderer.setScissorTest(true);
    renderer.setScissor(0,0,split,height);interior.setRaw(true);renderer.shadowMap.needsUpdate=true;renderer.render(scene,camera);
    renderer.setScissor(split,0,width-split,height);interior.setRaw(false);renderer.shadowMap.needsUpdate=true;renderer.render(scene,camera);
    renderer.setScissorTest(false);interior.setRaw(before);renderer.shadowMap.needsUpdate=true;
  }else composer.render();
}
const api={renderer,camera,scene,model,ceiling,controls,mouseLook,interior,walkWorld,wallBoxes,roomViews,
  fitView,goRoom,beginWalk,pauseWalk,refreshColliders,renderScene,
  get mode(){return currentView;},get night(){return night;},get compare(){return compare;},
  setTime,
  setRaw(value){interior.setRaw(value);refreshColliders();},
  setCompare(value){compare=value;document.getElementById('compare-ui').hidden=!value;},
  setCompareSplit(value){compareSplit=value;document.getElementById('compare-divider').style.left=(value*100)+'%';},
  setEditing(value){editing=value;if(value){pauseWalk();fitView('overview');}controls.enabled=currentView!=='walk';ao.enabled=!value&&container.clientWidth>700;},
  snapshot(){renderScene();return canvas.toDataURL('image/png');}
};
setTime('day');studio=mountStudio(api);
window.shellViewer.studio=studio;window.shellViewer.interior=interior;
window.shellViewer.snapshot=api.snapshot;
interior.ready.then(()=>{changeHeight(Number(heightControl.value));refreshColliders();studio.ready();status.textContent='客厅写实样板已就绪';})
  .catch(error=>{console.error(error);status.textContent='已显示基础家具，可继续查看';studio.ready();});
