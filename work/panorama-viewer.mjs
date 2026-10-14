import * as THREE from 'three';
import tour from './panorama-tour.json';

const $=id=>document.getElementById(id),view=$('view'),canvas=$('scene');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,preserveDrawingBuffer:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.NoToneMapping;
const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(64,1,.1,50);
const material=new THREE.MeshBasicMaterial({side:THREE.BackSide});
// Blender 经度图中心朝 +X；保持原纹理方向，不额外镜像家具或房间。
const geometry=new THREE.SphereGeometry(10,64,32);
const uv=geometry.attributes.uv;for(let i=0;i<uv.count;i++)uv.setX(i,1-uv.getX(i));
const sphere=new THREE.Mesh(geometry,material);scene.add(sphere);
const reduced=matchMedia('(prefers-reduced-motion:reduce)').matches;
let current=null,currentTheme='warm',requestedTheme='warm',pendingKey=null,yaw=0,pitch=0,requestId=0,dirty=true,noticeTimer,defaultFov=64;
const cache=new Map(),pointers=new Map();let gesture=null;
const roomButtons=new Map(),mapButtons=new Map();
const pointById=new Map(tour.points.map(point=>[point.id,point]));

function showNotice(text){$('notice').textContent=text;$('notice').hidden=false;clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>$('notice').hidden=true,2800);}
function markDirty(){dirty=true;}
function resize(){
  const nextFov=view.clientWidth<760?80:70;if(camera.fov===defaultFov)camera.fov=nextFov;defaultFov=nextFov;
  camera.aspect=view.clientWidth/view.clientHeight;renderer.setSize(view.clientWidth,view.clientHeight,false);camera.updateProjectionMatrix();markDirty();
}
new ResizeObserver(resize).observe(view);
function updateCamera(){camera.lookAt(Math.cos(pitch)*Math.cos(yaw),Math.sin(pitch),Math.cos(pitch)*Math.sin(yaw));markDirty();}
function resetView(){
  if(!current)return;
  const dx=current.look[0]-current.position[0],dy=current.look[1]-current.position[1],dz=current.look[2]-current.position[2];
  yaw=Math.atan2(dz,dx);pitch=Math.min(-.32,Math.atan2(dy,Math.hypot(dx,dz)));camera.fov=defaultFov;camera.updateProjectionMatrix();updateCamera();
}
function zoom(amount){camera.fov=THREE.MathUtils.clamp(camera.fov+amount,34,90);camera.updateProjectionMatrix();markDirty();}
function textureFor(point,theme){
  const key=theme+':'+point.id;
  let item=cache.get(key);if(item){item.touched=performance.now();return item.promise;}
  item={touched:performance.now(),texture:null};
  item.promise=new THREE.TextureLoader().loadAsync(point.images[theme]).then(texture=>{
    texture.colorSpace=THREE.SRGBColorSpace;texture.minFilter=THREE.LinearMipmapLinearFilter;texture.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
    item.texture=texture;return texture;
  }).catch(error=>{cache.delete(key);throw error;});
  cache.set(key,item);return item.promise;
}
function trimCache(){
  const candidates=[...cache].filter(([id,item])=>id!==currentTheme+':'+current?.id&&id!==pendingKey&&item.texture).sort((a,b)=>a[1].touched-b[1].touched);
  while(cache.size>3&&candidates.length){const [id,item]=candidates.shift();item.texture.dispose();cache.delete(id);}
}
async function navigate(id,{theme=requestedTheme,preserveView=false}={}){
  const point=pointById.get(id);if(!point)return;
  if(!tour.themes[theme])return;requestedTheme=theme;
  const ticket=++requestId;pendingKey=theme+':'+id;$('retry').hidden=true;$('loading-text').textContent='正在进入'+point.name+'…';
  if(!current)$('loading').hidden=false;else if(!reduced)$('fade').classList.add('visible');
  try{
    const texture=await textureFor(point,theme);if(ticket!==requestId){trimCache();return;}pendingKey=null;
    current=point;currentTheme=theme;material.map=texture;material.needsUpdate=true;
    if(preserveView)markDirty();else resetView();
    $('room-name').textContent=point.name;
    $('theme-name').textContent=tour.themes[theme].name+' · 360°环视';
    document.querySelectorAll('[data-theme]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.theme===theme)));
    for(const [key,button] of roomButtons)button.setAttribute('aria-pressed',String(key===id));
    for(const [key,button] of mapButtons){button.querySelector('circle').setAttribute('fill',key===id?'#ffffff':'#9eb8a0');button.setAttribute('aria-pressed',String(key===id));}
    buildHotspots();trimCache();$('loading').hidden=true;$('fade').classList.remove('visible');
    if(location.hash!=='#'+theme+'/'+id)history.replaceState(null,'','#'+theme+'/'+id);
    window.panoramaViewer.ready=true;
  }catch(error){
    if(ticket!==requestId)return;pendingKey=null;trimCache();console.error(error);$('fade').classList.remove('visible');
    if(current)showNotice('这个点位未能载入，请再点一次。');
    else{$('loading-text').textContent='全景载入失败';$('retry').hidden=false;}
  }
}
function switchTheme(theme){return navigate(current?.id||tour.points[0].id,{theme,preserveView:!!current});}
document.querySelectorAll('[data-theme]').forEach(button=>button.addEventListener('click',()=>switchTheme(button.dataset.theme)));
function buildHotspots(){
  $('hotspots').replaceChildren();
  for(const id of current.links){
    const target=pointById.get(id);if(!target)continue;
    const position=tour.hotspotPositions[current.id+'>'+id];if(!position)continue;
    const button=document.createElement('button');button.className='hotspot';button.setAttribute('aria-label','进入'+target.name);
    const ring=document.createElement('span');ring.className='ring';const text=document.createElement('span');text.className='text';text.textContent=target.name;
    button.append(ring,text);button.addEventListener('click',()=>navigate(id));
    button._direction=new THREE.Vector3(...position);$('hotspots').append(button);
  }
}
function updateHotspots(){
  const forward=camera.getWorldDirection(new THREE.Vector3());
  for(const button of $('hotspots').children){
    const p=button._direction.clone().project(camera),visible=button._direction.dot(forward)>0&&Math.abs(p.x)<.93&&p.y>-.78&&p.y<.82;
    button.hidden=!visible;button.style.left=((p.x+1)*view.clientWidth/2)+'px';button.style.top=((1-p.y)*view.clientHeight/2)+'px';
  }
  const arrow=$('map-direction');if(arrow&&current)arrow.setAttribute('transform',`translate(${current.position[0]} ${current.position[2]}) rotate(${yaw*180/Math.PI+90})`);
}
for(const point of tour.points){
  const button=document.createElement('button');button.textContent=point.name;button.setAttribute('aria-pressed','false');button.addEventListener('click',()=>navigate(point.id));
  $('rooms').append(button);roomButtons.set(point.id,button);
}
const ns='http://www.w3.org/2000/svg';
function svg(tag,attrs,parent){const node=document.createElementNS(ns,tag);for(const [key,value] of Object.entries(attrs))node.setAttribute(key,value);parent.append(node);return node;}
$('map').setAttribute('viewBox','-.7 -.5 10.9 13.5');
svg('polygon',{points:tour.outline.map(p=>p.join(',')).join(' '),fill:'#e2e6d9',stroke:'#8a9e8c','stroke-width':.10},$('map'));
for(const wall of tour.walls)svg('line',{x1:wall[0],y1:wall[1],x2:wall[2],y2:wall[3],stroke:'#546c59','stroke-width':.10},$('map'));
for(const point of tour.points){
  const group=svg('g',{tabindex:0,role:'button','aria-label':'进入'+point.name},$('map'));
  svg('circle',{cx:point.position[0],cy:point.position[2],r:.24,fill:'#9eb8a0',stroke:'#28432e','stroke-width':.08},group);
  svg('title',{},group).textContent=point.name;group.addEventListener('click',()=>navigate(point.id));
  group.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();navigate(point.id);}});mapButtons.set(point.id,group);
}
svg('path',{id:'map-direction',d:'M 0 -.75 L -.30 -.25 L .30 -.25 Z',fill:'#325e44','pointer-events':'none'},$('map'));
canvas.addEventListener('pointerdown',e=>{
  canvas.setPointerCapture(e.pointerId);canvas.focus();pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});canvas.classList.add('dragging');
  if(pointers.size===2){const [a,b]=[...pointers.values()];gesture={distance:Math.hypot(a.x-b.x,a.y-b.y),fov:camera.fov};}
});
canvas.addEventListener('pointermove',e=>{
  const previous=pointers.get(e.pointerId);if(!previous)return;
  const dx=e.clientX-previous.x,dy=e.clientY-previous.y;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(pointers.size===2&&gesture){const [a,b]=[...pointers.values()];camera.fov=THREE.MathUtils.clamp(gesture.fov*gesture.distance/Math.max(1,Math.hypot(a.x-b.x,a.y-b.y)),34,90);camera.updateProjectionMatrix();markDirty();}
  else{yaw-=dx*.0032;pitch=THREE.MathUtils.clamp(pitch+dy*.0032,-Math.PI/2+.03,Math.PI/2-.03);updateCamera();}
});
function release(e){pointers.delete(e.pointerId);gesture=null;if(!pointers.size)canvas.classList.remove('dragging');}
canvas.addEventListener('pointerup',release);canvas.addEventListener('pointercancel',release);canvas.addEventListener('lostpointercapture',release);
window.addEventListener('blur',()=>{pointers.clear();gesture=null;canvas.classList.remove('dragging');});
canvas.addEventListener('wheel',e=>{e.preventDefault();zoom(e.deltaY*.025);},{passive:false});
canvas.addEventListener('keydown',e=>{
  if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','-'].includes(e.key)){
    e.preventDefault();if(e.key==='ArrowLeft')yaw-=.075;if(e.key==='ArrowRight')yaw+=.075;
    if(e.key==='ArrowUp')pitch+=.06;if(e.key==='ArrowDown')pitch-=.06;
    pitch=THREE.MathUtils.clamp(pitch,-1.5,1.5);if(e.key==='+')zoom(-4);if(e.key==='-')zoom(4);updateCamera();
  }
});
$('zoom-in').addEventListener('click',()=>zoom(-7));$('zoom-out').addEventListener('click',()=>zoom(7));$('reset').addEventListener('click',resetView);
$('clean').addEventListener('click',()=>{document.body.classList.toggle('chrome-hidden');resize();});
$('full').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{showNotice('当前窗口不支持全屏，可用浏览器打开。');}});
$('help').addEventListener('click',()=>$('help-dialog').showModal());
$('retry').addEventListener('click',()=>navigate(tour.points[0].id));
$('shot').addEventListener('click',()=>{
  renderer.render(scene,camera);const link=document.createElement('a');link.href=canvas.toDataURL('image/png');link.download='我的家-'+tour.themes[currentTheme].name+'-'+current.name+'.png';link.click();
});
renderer.setAnimationLoop(()=>{if(!dirty||!material.map)return;dirty=false;renderer.render(scene,camera);updateHotspots();});
function readLocation(){
  const parts=location.hash.slice(1).split('/');
  return parts.length===2?{theme:parts[0],id:parts[1]}:{theme:'warm',id:parts[0]};
}
window.addEventListener('hashchange',()=>{const {theme,id}=readLocation();navigate(id,{theme});});
window.panoramaViewer={ready:false,navigate,switchTheme,resetView,camera,renderer,get current(){return current?.id;},get theme(){return currentTheme;},get yaw(){return yaw;},get pitch(){return pitch;},get cachedTextures(){return cache.size;}};
const initial=readLocation();resize();navigate(pointById.has(initial.id)?initial.id:tour.points[0].id,{theme:tour.themes[initial.theme]?initial.theme:'warm'});
