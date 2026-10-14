import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {canStand} from './walk.mjs';
import {findAreaZone} from './areas.mjs';
import {buildModel,x,z} from './model.mjs';

const capture=JSON.parse((await fs.readFile(new URL('./furnished-world.json',import.meta.url),'utf8')).replace(/^\uFEFF/,''));
assert(capture.success,'浏览器必须成功返回装修场景');
const {world,rooms,furniture,bathrooms=[]}=capture.data.result;
const fridge=furniture.find(item=>item.id==='fridge');
assert(fridge,'冰箱必须在可调整家具中');
assert(fridge.position[0]<x(430)&&fridge.position[2]>z(416)+.1&&fridge.position[2]<z(506)-.1,'冰箱必须位于外凸凹位');
assert(world.boxes.some(box=>box.id==='fridge'),'冰箱碰撞必须随可调整家具管理');
// 旧冰箱位置现在纳入北墙柜体；只确认冰箱本体仍位于外凸凹位。
const entrance=rooms.find(room=>room.id==='entrance');
assert(canStand(world,entrance.position[0],entrance.position[2]),'装修后玄关必须能站立');
const size=.10,width=106,depth=130;
const visited=new Uint8Array(width*depth),queue=[];
const startX=Math.round((entrance.position[0]+.55)/size),startZ=Math.round(entrance.position[2]/size);
queue.push([startX,startZ]);visited[startZ*width+startX]=1;
for(let head=0;head<queue.length;head++){
  const [ix,iz]=queue[head];
  for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
    const nx=ix+dx,nz=iz+dz;if(nx<0||nz<0||nx>=width||nz>=depth||visited[nz*width+nx])continue;
    if(!canStand(world,nx*size-.55,nz*size))continue;
    visited[nz*width+nx]=1;queue.push([nx,nz]);
  }
}
const reachable=[];
for(const room of rooms){
  const [px,,pz]=room.position;
  const ix=Math.round((px+.55)/size),iz=Math.round(pz/size);
  let found=false;
  for(let dx=-3;dx<=3;dx++)for(let dz=-3;dz<=3;dz++){
    const nx=ix+dx,nz=iz+dz;
    if(nx<0||nz<0||nx>=width||nz>=depth)continue;
    if(visited[nz*width+nx]&&findAreaZone(nx*size-.55,nz*size).id===room.id)found=true;
  }
  assert(found,`装修后${room.name}必须能从玄关步行到达`);reachable.push(room.name);
}
assert(furniture.every(item=>item.position.every(Number.isFinite)&&Number.isFinite(item.rotation)),'家具变换必须有效');
assert.equal(bathrooms.length,2,'必须检查两个卫生间的设备前方和淋浴通路');
const openings=buildModel().openings;
for(const bathroom of bathrooms){
  assert(bathroom.windowUnblocked,'湿区饰面必须保留窗洞');
  const door=openings.find(h=>h.wall===(bathroom.bathroom==='bath-west'?'Bath_Guest_South':'Bath_Master_South'));
  const sweep={minX:door.start,maxX:door.end,minZ:door.fixed-(door.end-door.start),maxZ:door.fixed};
  assert(world.boxes.filter(b=>b.roomId===bathroom.bathroom).every(b=>
    b.maxX<=sweep.minX||b.minX>=sweep.maxX||b.maxZ<=sweep.minZ||b.minZ>=sweep.maxZ),'门扇扫掠范围不能碰到卫浴设备');
  for(const [px,pz] of bathroom.accessPoints){
    assert(canStand(world,px,pz),`${bathroom.bathroom}设备前方必须能站立`);
    const ix=Math.round((px+.55)/size),iz=Math.round(pz/size);
    assert(visited[iz*width+ix],`${bathroom.bathroom}洗漱、如厕与淋浴位置必须可由玄关到达`);
  }
}
console.log(JSON.stringify({furniture:furniture.length,colliders:world.boxes.length,
  reachableRooms:reachable,reachableCells:queue.length,finiteTransforms:true,bathroomAccess:true},null,2));
