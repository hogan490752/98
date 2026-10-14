import assert from 'node:assert/strict';
import {outline, x, z} from './model.mjs';
import {areaReport, findAreaZone} from './areas.mjs';

// 鞋带公式独立核对外轮廓，避免同一分区算法自行印证。
const polygonArea = Math.abs(outline.reduce((sum,[px,pz],i) => {
  const [nextX,nextZ] = outline[(i+1)%outline.length];
  return sum + px*nextZ - nextX*pz;
},0))/2;
assert(Math.abs(polygonArea-areaReport.footprintArea)<1e-8, '矩形分解必须覆盖完整轮廓');
assert(Math.abs(polygonArea-98)<1e-8, '模型几何轮廓含墙体和赠送空间必须合计98㎡');
assert(Math.abs(areaReport.netArea+areaReport.wallArea-polygonArea)<1e-8, '墙体扣除不能遗漏或重复');
assert(areaReport.spaces.every(space => space.netArea>0), '所有空间面积必须为正');
assert(new Set(areaReport.spaces.map(space=>space.id)).size===13, '每个空间只能出现一次');
assert.equal(areaReport.spaces.reduce((sum,space)=>sum+Math.round(space.netDisplay*100),0)+Math.round(areaReport.wallDisplay*100),9800,
  '各空间扣墙面积与墙体相加必须严格等于98.00㎡');
assert.equal(areaReport.spaces.reduce((sum,space)=>sum+Math.round(space.netDisplay*100),0),Math.round(areaReport.netArea*100),
  '净面积明细必须与展示合计一致');
for(const space of areaReport.spaces) assert(Math.abs(space.netDisplay-space.netArea)<.01001,
  `${space.name}的标注必须对应模型几何面积`);
const master = areaReport.spaces.find(space=>space.id==='master');
const masterRectangle = 3.2 * (z(879)-.1-z(581)-.06);
assert(Math.abs(master.netArea-masterRectangle)<1e-8, '主卧面积须与净宽乘净深一致');
assert.equal(findAreaZone(x(463),z(221)).id,'entrance');
assert.equal(findAreaZone(x(610),z(185)).id,'small-room');
assert.equal(findAreaZone(x(953),z(726)).id,'master');
console.log(JSON.stringify({coverage:true, wallUnion:true, spaces:13,
  modelNetArea:areaReport.netDisplayTotal, walls:areaReport.wallDisplay, geometricTotal:98,
  masterRectangle:true, currentSpaceDetection:true},null,2));
