import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {canStand} from './walk.mjs';
import {findAreaZone} from './areas.mjs';

const points=JSON.parse(await fs.readFile(new URL('./panorama-points.json',import.meta.url),'utf8'));
const capture=JSON.parse((await fs.readFile(new URL('./furnished-world.json',import.meta.url),'utf8')).replace(/^\uFEFF/,''));
const world=capture.data.result.world;
assert.equal(points.length,11);assert.equal(new Set(points.map(p=>p.id)).size,11);
for(const point of points){
  const [x,,z]=point.position;
  assert(canStand(world,x,z),'点位不能在墙或家具里：'+point.name);
  assert.equal(findAreaZone(x,z).id,point.id,'点位所属房间错误：'+point.name);
  assert(point.links.every(id=>points.some(p=>p.id===id)),'相邻点位必须有效');
}
const tour=JSON.parse(await fs.readFile(new URL('./panorama-tour.json',import.meta.url),'utf8'));
assert(tour.walls.flat().every(Number.isFinite),'小地图墙体坐标必须有效');
for(const [key,direction] of Object.entries(tour.hotspotPositions)){
  const point=points.find(p=>p.id===key.split('>')[0]);
  assert(canStand(world,point.position[0]+direction[0],point.position[2]+direction[2],.07),'圆环不能落在墙或家具里：'+key);
}
assert.equal(tour.points.length,11,'发布必须覆盖全部11个点位');
assert.deepEqual(Object.keys(tour.themes),['warm','minimal','urban']);
for(const point of tour.points)for(const theme of Object.keys(tour.themes)){
  const bytes=Buffer.from(point.images[theme].split(',')[1],'base64');assert.equal(bytes.readUInt16BE(0),0xffd8);
  assert.equal(bytes.readUInt16BE(bytes.length-2),0xffd9);assert(bytes.length>100000,'全景图尺寸过小');
}
console.log(JSON.stringify({validPointLocations:points.length,readyPanoramas:tour.points.length*3,themes:3,embeddedJPEG:true,finiteMap:true},null,2));
