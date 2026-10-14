// 实际场景验证：人数、身高、骨长、家具跟随和毛坯可见性。
(async()=>{
  const api=shellViewer,interior=api.interior;await interior.ready;
  const vector=()=>api.camera.position.clone(),counts={},heights={};
  function visible(object){for(let p=object;p;p=p.parent)if(!p.visible)return false;return true;}
  for(const person of interior.people){
    const {height_m:h,room,pose}=person.userData;
    counts[room]=(counts[room]||0)+1;heights[h]=(heights[h]||0)+1;
    const scale=person.getWorldScale(vector());if([scale.x,scale.y,scale.z].some(v=>Math.abs(v-1)>1e-6))throw Error('人体被家具缩放');
    const bones=JSON.parse(person.userData.joint_positions),world=p=>person.localToWorld(vector().set(p[0],p[2],-p[1]));
    for(const side of Object.values(bones))for(const [a,b,ratio] of [['hip','knee',.244],['knee','ankle',.242],['shoulder','elbow',.186],['elbow','wrist',.146]]){
      if(Math.abs(world(side[a]).distanceTo(world(side[b]))-h*ratio)>1e-5)throw Error('世界坐标骨长错误');
    }
    if(pose==='standing'){
      const ys=[];person.traverse(mesh=>{if(!mesh.isMesh)return;const p=mesh.geometry.attributes.position;
        for(let i=0;i<p.count;i++)ys.push(vector().fromBufferAttribute(p,i).applyMatrix4(mesh.matrixWorld).y);
      });
      if(Math.abs(Math.max(...ys)-Math.min(...ys)-h)>1e-5)throw Error('实际站高错误');
    }
  }
  const person=interior.people.find(p=>p.userData.mannequin_id==='dining-1'),chair=person.parent;
  const before=person.getWorldPosition(vector());chair.position.x+=.05;chair.updateMatrixWorld(true);
  const after=person.getWorldPosition(vector());chair.position.x-=.05;chair.updateMatrixWorld(true);
  if(Math.abs(after.x-before.x-.05)>1e-6)throw Error('人未跟随家具移动');
  chair.visible=false;const hiddenWithFurniture=!visible(person);chair.visible=true;
  if(!hiddenWithFurniture)throw Error('家具隐藏后人仍悬空');
  interior.setRaw(true);const hiddenInRaw=interior.people.every(p=>!visible(p));interior.setRaw(false);
  if(!hiddenInRaw)throw Error('毛坯模式残留装修假人');
  return {people:interior.people.length,counts,heights,visible:interior.people.filter(visible).length,bones:'verified',standingMeshes:'verified',followFurniture:true,hideWithFurniture:true,rawHidesPeople:true};
})()
