import * as THREE from 'three';
import {TransformControls} from 'three/addons/controls/TransformControls.js';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {canStand} from './walk.mjs';
import {themes} from './interior.mjs';
import {outline} from './model.mjs';

export function mountStudio(api) {
  const {camera,scene,renderer,interior,roomViews}=api;
  const $=id=>document.getElementById(id);
  const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const state={editing:false,selected:null,tour:false,tourStart:0,tourIndex:-1,overrides:{},undo:[]};
  let toastTimer,dragStart=null,pointerStart=null;
  function toast(text) {
    $('toast').textContent=text;$('toast').hidden=false;
    clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,3200);
  }
  function download(blob,name) {
    const link=document.createElement('a'),url=URL.createObjectURL(blob);
    link.href=url;link.download=name;link.hidden=true;document.body.appendChild(link);link.click();link.remove();
    setTimeout(()=>URL.revokeObjectURL(url),60000);
  }
  const controls=new TransformControls(camera,renderer.domElement);
  controls.setTranslationSnap(.05);controls.setRotationSnap(Math.PI/12);controls.showY=false;
  const gizmo=controls.getHelper();gizmo.visible=false;scene.add(gizmo);
  const selection=new THREE.BoxHelper(undefined,0x6aac91);selection.visible=false;scene.add(selection);
  function snapshotLayout(){return interior.pieces.map(item=>({id:item.userData.id,position:item.position.toArray(),rotation:item.rotation.y,visible:item.visible}));}
  function restoreLayout(items) {
    for(const data of items){const item=interior.pieces.find(piece=>piece.userData.id===data.id);if(!item)continue;
      const old=item.userData.previousDefault;
      const position=old&&data.position.every((value,i)=>Math.abs(value-old[i])<1e-5)?item.userData.fittedDefault:data.position;
      item.position.fromArray(position);item.position.y=0;item.rotation.y=data.rotation;item.visible=data.visible!==false;}
    api.refreshColliders();syncFields();
  }
  function checkpoint(snapshot=snapshotLayout()){state.undo.push(snapshot);if(state.undo.length>20)state.undo.shift();$('undo-layout').disabled=false;}
  function valid(item) {
    const index=interior.pieces.indexOf(item),boxes=interior.colliders(true);
    if(index<0)return false;
    const {width,depth}=item.userData,a=item.rotation.y,w=Math.abs(Math.cos(a))*width+Math.abs(Math.sin(a))*depth,
      d=Math.abs(Math.sin(a))*width+Math.abs(Math.cos(a))*depth;
    const own=boxes.find(box=>box.id===item.userData.id)||{minX:item.position.x-w/2,maxX:item.position.x+w/2,
      minZ:item.position.z-d/2,maxZ:item.position.z+d/2,id:item.userData.id};
    for(const [px,pz] of [[own.minX,own.minZ],[own.maxX,own.minZ],[own.maxX,own.maxZ],[own.minX,own.maxZ]])
      if(!canStand({boxes:api.wallBoxes,polygon:outline},px,pz,.002))return false;
    if(api.wallBoxes.some(box=>own.minX<box.maxX-.002&&own.maxX>box.minX+.002&&own.minZ<box.maxZ-.002&&own.maxZ>box.minZ+.002))return false;
    if(!item.userData.collidable)return true;
    return !boxes.some(box=>box!==own&&own.minX<box.maxX-.025&&own.maxX>box.minX+.025&&own.minZ<box.maxZ-.025&&own.maxZ>box.minZ+.025);
  }
  function syncFields() {
    const item=state.selected;$('selected-name').textContent=item?item.name:'选择一件家具';
    $('item-controls').hidden=!item;
    if(!item)return;
    $('furniture-select').value=item.userData.id;$('item-x').value=item.position.x.toFixed(2);
    $('item-z').value=item.position.z.toFixed(2);$('item-angle').value=Math.round(THREE.MathUtils.radToDeg(item.rotation.y));
    $('item-size').textContent=`示意尺寸 ${item.userData.width.toFixed(2)} × ${item.userData.depth.toFixed(2)} 米`;
    $('item-visibility').textContent=item.visible?'隐藏这件家具':'恢复这件家具';
  }
  function select(item) {
    state.selected=item;
    if(item){if(!state.editing)setEditing(true);controls.attach(item);gizmo.visible=true;selection.setFromObject(item);selection.visible=true;}
    else{controls.detach();gizmo.visible=false;selection.visible=false;}
    syncFields();
  }
  function setEditing(value) {
    state.editing=value;state.tour=false;api.setCompare(false);$('compare-toggle').setAttribute('aria-pressed','false');
    if(value){api.setRaw(false);$('raw-toggle').setAttribute('aria-pressed','false');}
    api.setEditing(value);$('edit-toggle').setAttribute('aria-pressed',String(value));
    $('edit-toggle').textContent=value?'结束家具调整':'开启家具调整';
    $('edit-help').hidden=!value;
    if(!value)select(null);
    $('tour-toggle').setAttribute('aria-pressed','false');
  }
  interior.pieces.forEach(item=>{const option=document.createElement('option');option.value=item.userData.id;option.textContent=item.name;$('furniture-select').appendChild(option);});
  $('furniture-select').addEventListener('change',e=>select(interior.pieces.find(item=>item.userData.id===e.target.value)));
  $('edit-toggle').addEventListener('click',()=>setEditing(!state.editing));
  $('move-mode').addEventListener('click',()=>{controls.setMode('translate');controls.showX=true;controls.showY=false;controls.showZ=true;});
  $('rotate-mode').addEventListener('click',()=>{controls.setMode('rotate');controls.showX=false;controls.showY=true;controls.showZ=false;});
  controls.addEventListener('dragging-changed',e=>{
    api.controls.enabled=!e.value;
    if(e.value)dragStart=snapshotLayout();
    else if(state.selected){if(valid(state.selected)){checkpoint(dragStart);api.refreshColliders();}else{restoreLayout(dragStart);toast('此位置碰到墙体或家具，已恢复。');}syncFields();}
  });
  controls.addEventListener('objectChange',()=>{if(state.selected){state.selected.position.y=0;api.refreshColliders();syncFields();}});
  function changePosition() {
    const item=state.selected;if(!item)return;
    const before=snapshotLayout();
    const px=Number($('item-x').value),pz=Number($('item-z').value),angle=Number($('item-angle').value);
    if(![px,pz,angle].every(Number.isFinite)){syncFields();return;}
    item.position.set(px,0,pz);item.rotation.y=THREE.MathUtils.degToRad(angle);
    if(!valid(item)){restoreLayout(before);toast('此位置碰到墙体或其他家具。');return;}
    checkpoint(before);api.refreshColliders();syncFields();
  }
  ['item-x','item-z','item-angle'].forEach(id=>$(id).addEventListener('change',changePosition));
  $('item-visibility').addEventListener('click',()=>{
    const item=state.selected;if(!item)return;const before=snapshotLayout();item.visible=!item.visible;
    if(item.visible&&!valid(item)){restoreLayout(before);toast('原位置已被占用，请先腾出位置再恢复。');return;}
    checkpoint(before);api.refreshColliders();syncFields();
  });
  $('undo-layout').addEventListener('click',()=>{const previous=state.undo.pop();if(previous)restoreLayout(previous);$('undo-layout').disabled=!state.undo.length;});
  $('reset-layout').addEventListener('click',()=>{checkpoint();interior.reset();api.refreshColliders();syncFields();toast('已恢复初始布置，可撤销。');});

  const ray=new THREE.Raycaster(),pointer=new THREE.Vector2();
  const markers=new THREE.Group();markers.name='房间跳转点';scene.add(markers);
  roomViews.forEach(room=>{
    const point=new THREE.Group();point.userData.roomId=room.id;point.position.set(room.position[0],.035,room.position[2]);
    const ring=new THREE.Mesh(new THREE.RingGeometry(.145,.185,40),new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.75,side:THREE.DoubleSide,depthWrite:false}));
    ring.rotation.x=-Math.PI/2;point.add(ring);
    const center=new THREE.Mesh(new THREE.CircleGeometry(.145,32),new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.10,side:THREE.DoubleSide,depthWrite:false}));
    center.rotation.x=-Math.PI/2;point.add(center);markers.add(point);
  });
  renderer.domElement.addEventListener('pointerdown',e=>{pointerStart={x:e.clientX,y:e.clientY};});
  renderer.domElement.addEventListener('pointerup',e=>{
    if(!pointerStart||Math.hypot(e.clientX-pointerStart.x,e.clientY-pointerStart.y)>5||controls.dragging)return;
    const rect=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);ray.setFromCamera(pointer,camera);
    if(state.editing){const hit=ray.intersectObjects(interior.pieces,true)[0];if(!hit)return;
      let parent=hit.object;while(parent&&!parent.userData.editable)parent=parent.parent;if(parent)select(parent);
    }else if(api.mode==='walk'&&!api.mouseLook.isLocked){
      const hits=ray.intersectObjects([api.model.root,interior.group,markers],true);
      const hit=hits.find(item=>!(item.object.material?.transparent&&item.object.material.opacity<.2));
      if(!hit)return;let parent=hit.object;while(parent&&!parent.userData.roomId)parent=parent.parent;
      if(parent)navigate(parent.userData.roomId);
    }
  });

  const map=$('minimap-svg');
  map.setAttribute('viewBox','-.9 -.6 11.1 14');
  const ns='http://www.w3.org/2000/svg';
  const floor=document.createElementNS(ns,'polygon');floor.setAttribute('points',outline.map(point=>point.join(',')).join(' '));floor.setAttribute('class','map-floor');map.appendChild(floor);
  api.model.solids.filter(item=>item.userData.base===0).forEach(item=>{
    const rect=document.createElementNS(ns,'rect');rect.setAttribute('x',item.position.x-item.userData.width/2);rect.setAttribute('y',item.position.z-item.userData.depth/2);
    rect.setAttribute('width',item.userData.width);rect.setAttribute('height',item.userData.depth);rect.setAttribute('class','map-wall');map.appendChild(rect);
  });
  roomViews.forEach(room=>{
    const point=document.createElementNS(ns,'circle');point.setAttribute('cx',room.position[0]);point.setAttribute('cy',room.position[2]);point.setAttribute('r','.23');point.setAttribute('class','map-room');
    point.setAttribute('role','button');point.setAttribute('tabindex','0');point.setAttribute('aria-label','进入'+room.name);
    point.addEventListener('click',()=>navigate(room.id));point.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();navigate(room.id);}});map.appendChild(point);
    const button=document.createElement('button');button.textContent=room.name;button.dataset.room=room.id;button.setAttribute('aria-pressed',String(room.id==='living'));
    button.addEventListener('click',()=>navigate(room.id));$('room-nav').appendChild(button);
  });
  const cursor=document.createElementNS(ns,'g');cursor.setAttribute('class','map-camera');
  cursor.innerHTML='<path d="M0,0 L-.42,-.72 L.42,-.72 Z" class="map-cone"></path><circle r=".18"></circle>';
  map.appendChild(cursor);
  function navigate(id) {
    state.tour=false;$('tour-toggle').setAttribute('aria-pressed','false');
    if(state.editing)setEditing(false);
    if(api.mouseLook.isLocked)api.mouseLook.unlock();
    if(!api.goRoom(id)){toast('这个位置被家具挡住，请先调整布置。');return;}
    $('room-nav').querySelectorAll('button').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.room===id)));
  }

  function switchPane(id) {
    if(id!=='layout'&&state.editing)setEditing(false);
    document.querySelectorAll('[data-pane]').forEach(button=>{const active=button.dataset.pane===id;button.setAttribute('aria-selected',String(active));});
    document.querySelectorAll('.inspector-pane').forEach(pane=>{pane.hidden=pane.id!=='pane-'+id;});
    if(id==='areas'){api.fitView('top');$('labels').checked=true;$('labels').dispatchEvent(new Event('change'));}
  }
  const paneButtons=[...document.querySelectorAll('[data-pane]')];
  paneButtons.forEach((button,index)=>{
    button.id='tab-'+button.dataset.pane;button.setAttribute('aria-controls','pane-'+button.dataset.pane);
    const panel=$('pane-'+button.dataset.pane);panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby',button.id);
    button.addEventListener('click',()=>switchPane(button.dataset.pane));
    button.addEventListener('keydown',e=>{if(e.key!=='ArrowRight'&&e.key!=='ArrowLeft')return;
      e.preventDefault();const next=paneButtons[(index+(e.key==='ArrowRight'?1:-1)+paneButtons.length)%paneButtons.length];next.focus();next.click();});
  });
  $('toggle-inspector').addEventListener('click',()=>{const hidden=document.body.classList.toggle('inspector-closed');$('toggle-inspector').setAttribute('aria-expanded',String(!hidden));});
  $('close-inspector').addEventListener('click',()=>{document.body.classList.add('inspector-closed');$('toggle-inspector').setAttribute('aria-expanded','false');});
  const mobileQuery=matchMedia('(max-width:760px)');
  const closeMobile=()=>{if(mobileQuery.matches&&location.hash!=='#areas'){$('close-inspector').click();}};
  closeMobile();mobileQuery.addEventListener('change',closeMobile);
  function syncTheme(id) {
    interior.setTheme(id);state.overrides={};
    document.querySelectorAll('[data-theme]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.theme===id)));
    $('scheme-name').textContent=themes[id].name;
    $('scheme-detail').textContent=themes[id].subtitle;
    $('wall-color').value=themes[id].paint;$('sofa-color').value=themes[id].fabric;
    const floor=themes[id].floorType==='stone'?'stone':id==='urban'?'dark-wood':'wood';
    document.querySelectorAll('[data-floor]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.floor===floor)));
  }
  document.querySelectorAll('[data-theme]').forEach(button=>button.addEventListener('click',()=>{syncTheme(button.dataset.theme);toast('已切换为'+themes[button.dataset.theme].name);if(mobileQuery.matches)$('close-inspector').click();}));
  ['wall-color','sofa-color'].forEach(id=>$(id).addEventListener('input',e=>{
    const role=id==='wall-color'?'paint':'fabric';interior.materials[role].color.set(e.target.value);state.overrides[role]=e.target.value;$('scheme-detail').textContent='已自定义材质';
  }));
  document.querySelectorAll('[data-floor]').forEach(button=>button.addEventListener('click',()=>{
    interior.setFloor(button.dataset.floor);state.overrides.floor=button.dataset.floor;
    document.querySelectorAll('[data-floor]').forEach(item=>item.setAttribute('aria-pressed',String(item===button)));$('scheme-detail').textContent='已自定义材质';
  }));
  document.querySelectorAll('[data-time]').forEach(button=>button.addEventListener('click',()=>{
    api.setTime(button.dataset.time);document.querySelectorAll('[data-time]').forEach(item=>item.setAttribute('aria-pressed',String(item===button)));
  }));
  $('raw-toggle').addEventListener('click',()=>{const raw=!interior.raw;if(state.editing)setEditing(false);api.setRaw(raw);$('raw-toggle').setAttribute('aria-pressed',String(raw));});
  $('compare-toggle').addEventListener('click',()=>{if(state.editing)setEditing(false);api.setCompare(!api.compare);$('compare-toggle').setAttribute('aria-pressed',String(api.compare));});
  $('compare-split').addEventListener('input',e=>api.setCompareSplit(Number(e.target.value)/100));

  function configuration(){return {version:1,theme:interior.theme,time:api.night?'night':'day',overrides:{...state.overrides},furniture:snapshotLayout()};}
  function applyConfiguration(data) {
    if(data.version!==1||!themes[data.theme]||!Array.isArray(data.furniture))throw new Error('方案文件格式不正确');
    for(const item of data.furniture) if(!Array.isArray(item.position)||item.position.length!==3||!item.position.every(Number.isFinite)||!Number.isFinite(item.rotation))throw new Error('家具坐标不正确');
    const before=snapshotLayout();restoreLayout(data.furniture);
    if(interior.pieces.some(item=>item.visible&&!valid(item))){restoreLayout(before);throw new Error('家具位置碰到墙体或其他家具');}
    syncTheme(data.theme);api.setTime(data.time==='night'?'night':'day');
    const overrides=data.overrides||{};
    for(const role of ['paint','fabric']) if(typeof overrides[role]==='string'&&/^#[a-f\d]{6}$/i.test(overrides[role]))interior.materials[role].color.set(overrides[role]);
    if(['wood','dark-wood','stone'].includes(overrides.floor)){
      interior.setFloor(overrides.floor);
      document.querySelectorAll('[data-floor]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.floor===overrides.floor)));
    }
    state.overrides=overrides;$('wall-color').value=interior.materials.paint.color.getHexString()? '#'+interior.materials.paint.color.getHexString():themes[data.theme].paint;
    $('sofa-color').value='#'+interior.materials.fabric.color.getHexString();
    document.querySelectorAll('[data-time]').forEach(item=>item.setAttribute('aria-pressed',String(item.dataset.time===(api.night?'night':'day'))));
  }
  $('save-layout').addEventListener('click',()=>{try{localStorage.setItem('single-home-studio-v1',JSON.stringify(configuration()));toast('方案已保存在本机浏览器。');}catch{toast('当前浏览器不能保存，请使用导出方案。');}});
  $('export-config').addEventListener('click',()=>download(new Blob([JSON.stringify(configuration(),null,2)],{type:'application/json'}),'我的家-装修方案.json'));
  $('import-config').addEventListener('change',async e=>{const file=e.target.files[0];if(!file)return;
    try{const data=JSON.parse(await file.text());checkpoint();applyConfiguration(data);toast('已导入装修方案。');}catch(error){toast('导入失败：'+error.message);}e.target.value='';
  });
  $('screenshot').addEventListener('click',()=>{
    selection.visible=false;gizmo.visible=false;markers.visible=false;
    const image=api.snapshot();download(new Blob([Uint8Array.from(atob(image.split(',')[1]),char=>char.charCodeAt(0))],{type:'image/png'}),'我的家-'+themes[interior.theme].name+'.png');
    selection.visible=state.editing&&!!state.selected;gizmo.visible=selection.visible;markers.visible=api.mode==='walk';toast('已生成当前视角截图。');
  });
  $('export-model').addEventListener('click',async()=>{
    const button=$('export-model');button.disabled=true;button.textContent='正在导出…';
    try{
      // 导出完整高度的副本，异步生成文件期间不会改变页面剖切或毛坯状态。
      const shell=api.model.root.clone(true);
      shell.traverse(item=>{
        if(item.isLineSegments)item.visible=false;
        if(item.isMesh&&Number.isFinite(item.userData.top)){
          item.visible=true;item.scale.y=1;item.position.y=(item.userData.base+item.userData.top)/2;item.material=interior.materials.paint;
        }
      });
      shell.children.find(item=>item.name===api.model.slab.name).material=interior.materials.floor;
      const decorated=interior.group.clone(true);decorated.visible=true;
      decorated.traverse(item=>{if(item.isReflector)item.material=interior.materials.mirror;});
      const roof=api.ceiling.clone();roof.visible=true;roof.material=interior.materials.paint;
      const root=new THREE.Group();root.name='装修示意-'+themes[interior.theme].name;root.add(shell,decorated,roof);
      const binary=await new GLTFExporter().parseAsync(root,{binary:true,onlyVisible:true,maxTextureSize:1024});
      download(new Blob([binary],{type:'model/gltf-binary'}),'我的家-'+themes[interior.theme].name+'.glb');toast('装修模型已导出。');
    }catch(error){toast('导出失败：'+error.message);}finally{
      button.disabled=false;button.textContent='导出装修模型';
    }
  });
  $('tour-toggle').addEventListener('click',()=>{
    if(state.editing)setEditing(false);state.tour=!state.tour;state.tourStart=performance.now();state.tourIndex=-1;
    $('tour-toggle').setAttribute('aria-pressed',String(state.tour));if(api.mouseLook.isLocked)api.mouseLook.unlock();
  });
  document.querySelectorAll('[data-move]').forEach(button=>{
    const mapping={forward:'w',back:'s',left:'a',right:'d'},key=mapping[button.dataset.move];
    const down=e=>{e.preventDefault();button.setPointerCapture(e.pointerId);document.dispatchEvent(new KeyboardEvent('keydown',{key,code:'Key'+key.toUpperCase(),bubbles:true}));};
    const up=()=>document.dispatchEvent(new KeyboardEvent('keyup',{key,code:'Key'+key.toUpperCase(),bubbles:true}));
    button.addEventListener('pointerdown',down);button.addEventListener('pointerup',up);button.addEventListener('pointercancel',up);
  });
  document.addEventListener('keydown',e=>{if(state.tour&&['w','a','s','d','escape'].includes(e.key.toLowerCase())){state.tour=false;$('tour-toggle').setAttribute('aria-pressed','false');}});
  try{const saved=localStorage.getItem('single-home-studio-v1');if(saved)applyConfiguration(JSON.parse(saved));else syncTheme('warm');}catch{syncTheme('warm');}
  if(location.hash==='#areas'){switchPane('areas');document.body.classList.remove('inspector-closed');}
  return {roomViews,interior,configuration,applyConfiguration,select,setEditing,navigate,
    ready(){$('loading').hidden=true;document.body.classList.add('scene-ready');},
    syncView(view){markers.visible=view==='walk';cursor.style.display=view==='walk'?'':'none';},
    update(now,delta){
      if(state.selected&&state.editing)selection.setFromObject(state.selected);
      const direction=camera.getWorldDirection(new THREE.Vector3());
      cursor.setAttribute('transform',`translate(${camera.position.x} ${camera.position.z}) rotate(${Math.atan2(direction.x,-direction.z)*180/Math.PI})`);
      if(state.tour){const index=Math.floor((now-state.tourStart)/4300);
        if(index>=roomViews.length){state.tour=false;$('tour-toggle').setAttribute('aria-pressed','false');toast('全屋导览结束。');}
        else{if(index!==state.tourIndex){api.goRoom(roomViews[index].id);state.tourIndex=index;}
          if(!reducedMotion)camera.rotateY(Math.sin((now-state.tourStart)/1500)*delta*.045);}
      }
    }
  };
}
