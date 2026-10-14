import {outline, walls, x, z, totalArea} from './model.mjs';

// 开放的客餐厅、玄关和过道按图中位置划区；这些分界不是新增隔墙。
export const areaZones = [
  {id:'small-room', name:'小房间', label:'小房间', anchor:[610,185],
    contains:(px,pz) => px >= x(526) && pz < z(276)},
  {id:'kitchen', name:'厨房', label:'厨房', anchor:[606,351],
    contains:(px,pz) => px >= x(526) && px < x(695) && pz >= z(276) && pz < z(431)},
  {id:'bedroom-north', name:'次卧2（北侧）', label:'次卧2', anchor:[862,481],
    contains:(px,pz) => px >= x(773) && px < x(951) && pz >= z(386) && pz < z(581)},
  {id:'bath-west', name:'卫生间1（西侧）', label:'卫1', anchor:[714,492],
    contains:(px,pz) => px >= x(655) && px < x(773) && pz >= z(386) && pz < z(581)},
  {id:'bath-east', name:'卫生间2（东侧）', label:'卫2', anchor:[1005,492],
    contains:(px,pz) => px >= x(951) && pz >= z(386) && pz < z(581)},
  {id:'master', name:'主卧', label:'主卧', anchor:[953,726],
    contains:(px,pz) => px >= x(846) && pz >= z(581) && pz < z(879)},
  {id:'bedroom-south', name:'次卧1（南侧）', label:'次卧1', anchor:[744,756],
    contains:(px,pz) => px >= x(655) && px < x(846) && pz >= z(670) && pz < z(865)},
  {id:'service', name:'设备平台（暂定）', label:'设备位', anchor:[876,928],
    contains:(px,pz) => px >= x(846) && pz >= z(879)},
  {id:'balcony', name:'阳台', label:'阳台', anchor:[615,923],
    contains:(px,pz) => pz >= z(865)},
  {id:'living', name:'客厅', label:'客厅', anchor:[525,724],
    contains:(px,pz) => px < x(655) && pz >= z(585) && pz < z(865)},
  {id:'entrance', name:'玄关', label:'玄关', anchor:[463,249],
    contains:(px,pz) => pz < z(431)},
  {id:'dining', name:'餐厅', label:'餐厅', anchor:[532,519],
    contains:(px,pz) => pz < z(585)},
  {id:'hall', name:'过道', label:'过道', anchor:[750,624], contains:() => true}
];

export function findAreaZone(px, pz) {
  return areaZones.find(zone => zone.contains(px, pz));
}

function inside(px, pz, polygon) {
  let result = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [ax, az] = polygon[i], [bx, bz] = polygon[j];
    if ((az > pz) !== (bz > pz) && px < (bx - ax) * (pz - az) / (bz - az) + ax) result = !result;
  }
  return result;
}

// 所有边界均为轴对齐线段：逐个精确矩形累加，避免栅格采样误差与墙体重复扣除。
export function calculateAreas() {
  const wallRects = walls.map(wall => {
    const half = wall.t / 2;
    return wall.axis === 'h' ?
      {x0:x(wall.a), x1:x(wall.b), z0:z(wall.at)-half, z1:z(wall.at)+half} :
      {x0:x(wall.at)-half, x1:x(wall.at)+half, z0:z(wall.a), z1:z(wall.b)};
  });
  const xs = new Set(outline.map(point => point[0]));
  const zs = new Set(outline.map(point => point[1]));
  wallRects.forEach(rect => {xs.add(rect.x0); xs.add(rect.x1); zs.add(rect.z0); zs.add(rect.z1);});
  [526,655,695,773,846,951].forEach(pixel => xs.add(x(pixel)));
  [276,386,431,581,585,670,865,879].forEach(pixel => zs.add(z(pixel)));
  const xCuts = [...xs].sort((a,b) => a-b), zCuts = [...zs].sort((a,b) => a-b);
  const totals = Object.fromEntries(areaZones.map(zone => [zone.id,0]));
  let footprintArea = 0, wallArea = 0;
  for (let i = 0; i < xCuts.length-1; i++) {
    for (let j = 0; j < zCuts.length-1; j++) {
      const px = (xCuts[i]+xCuts[i+1])/2, pz = (zCuts[j]+zCuts[j+1])/2;
      if (!inside(px,pz,outline)) continue;
      const area = (xCuts[i+1]-xCuts[i]) * (zCuts[j+1]-zCuts[j]);
      footprintArea += area;
      if (wallRects.some(rect => px > rect.x0 && px < rect.x1 && pz > rect.z0 && pz < rect.z1)) {
        wallArea += area;
      } else totals[findAreaZone(px,pz).id] += area;
    }
  }
  const spaces = areaZones.map(({id,name,label,anchor}) => ({id,name,label,anchor,netArea:totals[id]}));
  const netArea = spaces.reduce((sum,space) => sum+space.netArea,0);
  return {totalArea, footprintArea, wallArea, netArea, spaces,
    areaBasis:'按用户确认口径：图内全部空间（含赠送）加模型墙体投影合计98㎡',
    netMethod:'按模型墙体内侧计算；门洞门槛归入墙体投影；开放区域按图示位置划区',
    estimated:true};
}

// 最大余数法保留两位小数，保证各项展示值与合计严格一致。
export function roundedAllocation(values, total) {
  const cents = Math.round(total*100), sum = values.reduce((a,b) => a+b,0);
  const scaled = values.map(value => value/sum*cents);
  const rounded = scaled.map(Math.floor);
  const rank = scaled.map((value,i) => ({i,remainder:value-rounded[i]}))
    .sort((a,b) => b.remainder-a.remainder || a.i-b.i);
  const remaining = cents-rounded.reduce((a,b) => a+b,0);
  for (let i = 0; i < remaining; i++) rounded[rank[i].i]++;
  return rounded.map(value => value/100);
}

export const areaReport = calculateAreas();
const netDisplay = roundedAllocation(areaReport.spaces.map(space => space.netArea), areaReport.netArea);
areaReport.netDisplayTotal = Math.round(areaReport.netArea*100)/100;
areaReport.wallDisplay = (Math.round(totalArea*100)-Math.round(areaReport.netArea*100))/100;
areaReport.spaces.forEach((space,i) => {
  space.netDisplay = netDisplay[i];
});
export const displayedSpaces = ['entrance','small-room','kitchen','dining','living','hall','master',
  'bedroom-south','bedroom-north','bath-west','bath-east','balcony','service']
  .map(id => areaReport.spaces.find(space => space.id === id));
