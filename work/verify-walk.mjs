import assert from 'node:assert/strict';
import {buildModel, x, z, roomLabels} from './model.mjs';
import {createWalkWorld, canStand, moveWithCollisions, person} from './walk.mjs';

const model = buildModel();
const world = createWalkWorld(model);
const spawn = {x:x(463), z:z(221)};
assert(canStand(world, spawn.x, spawn.z), '入口必须可站立');
const smallRoomDoor = model.openings.find(hole => hole.wall === 'Entrance_Small_Room_Divider' && hole.kind === 'door');
assert(smallRoomDoor, '小房间必须从玄关墙上的门洞进入');
assert(!model.openings.some(hole => hole.wall === 'Kitchen_North' && hole.kind === 'door'), '小房间入口不在厨房侧');
const doorCenter = (smallRoomDoor.start + smallRoomDoor.end) / 2;
const intoSmallRoom = moveWithCollisions(world, {x:x(526) - .5, z:doorCenter}, 1.0, 0);
assert(intoSmallRoom.x > x(526) + .4, '人物必须能够通过玄关侧门洞走入小房间');

const kitchenDoor=model.openings.find(hole=>hole.wall==='Kitchen_West'&&hole.kind==='door');
assert(kitchenDoor,'厨房必须从玄关侧的西墙门洞进入');
const kitchenDoorCenter=(kitchenDoor.start+kitchenDoor.end)/2;
const intoKitchen=moveWithCollisions(world,{x:x(526)-.5,z:kitchenDoorCenter},1,0);
assert(intoKitchen.x>x(526)+.4,'人物必须能够通过玄关侧门洞进入厨房');
const kitchenSouth=model.solids.find(mesh=>mesh.name==='Kitchen_South_End'&&mesh.userData.base===0&&mesh.userData.top===2.9);
assert(kitchenSouth,'厨房朝餐厅的一侧必须有完整隔墙');
const stopAtKitchenSouth=moveWithCollisions(world,{x:x(590),z:z(431)+.5},0,-1);
assert(stopAtKitchenSouth.z>=z(431)+.06+person.radius-1e-6,'不能从餐厅穿入厨房');

// 高速撞墙也应停在墙内，防止帧率变化导致穿过 120 mm 薄墙。
const stop = moveWithCollisions(world, {x:1, z:z(750)}, -20, 0);
assert(stop.x >= person.radius - 1e-6, '不能穿过客厅西墙');
const windowStop = moveWithCollisions(world, {x:1.8, z:z(925)}, 0, 20);
assert(windowStop.z <= z(978) - .1 - person.radius + 1e-6, '不能穿过阳台落地窗');

// 实际地面上搜索通路，验证玄关到全部可居住房间的门洞连通性。
const step = .10, width = 105, depth = 128;
const visited = new Uint8Array(width * depth);
const parent = new Int32Array(width * depth).fill(-1);
const queue = [];
const cell = (ix, iz) => iz * width + ix;
const toPoint = (ix, iz) => ({x:ix * step - .55, z:iz * step});
const startX = Math.round((spawn.x + .55) / step), startZ = Math.round(spawn.z / step);
const start = cell(startX, startZ);
visited[start] = 1; queue.push([startX, startZ]);
for (let head = 0; head < queue.length; head++) {
  const [ix, iz] = queue[head];
  for (const [dx, dz] of [[1,0],[-1,0],[0,1],[0,-1]]) {
    const nx = ix + dx, nz = iz + dz;
    if (nx < 0 || nx >= width || nz < 0 || nz >= depth || visited[cell(nx,nz)]) continue;
    const next = toPoint(nx, nz);
    if (!canStand(world, next.x, next.z)) continue;
    visited[cell(nx,nz)] = 1;
    parent[cell(nx,nz)] = cell(ix,iz);
    queue.push([nx,nz]);
  }
}
const reached = [];
const paths = {};
roomLabels.forEach(([name, px, py], i) => {
  const ix = Math.round((x(px) + .55) / step), iz = Math.round(z(py) / step);
  const goal = cell(ix, iz);
  assert(visited[goal], `${name}（${px}, ${py}）必须可由玄关步行到达`);
  reached.push(`${name}_${i}`);
  if (name === '主卧' || name === '小房间') {
    const path = [];
    for (let current = goal; current !== -1; current = parent[current]) {
      const point = toPoint(current % width, Math.floor(current / width));
      path.push([point.x, point.z]);
    }
    paths[name === '主卧' ? 'master' : 'smallRoom'] = path.reverse();
  }
});
console.log(JSON.stringify({wallCollision:true, windowCollision:true,
  kitchenEntrance:'玄关',kitchenSouthWall:true,kitchenDoorPassable:true,
  smallRoomEntrance:'玄关', smallRoomDoorPassable:true,
  reachedRooms:reached, reachableCells:queue.length,
  masterRouteWaypoints:paths.master.length, smallRoomRouteWaypoints:paths.smallRoom.length}, null, 2));
// 给浏览器复现测试保留一条经真实碰撞检测的步行路线。
const fs = await import('node:fs/promises');
await fs.writeFile(new URL('./walk-test-route.json', import.meta.url), JSON.stringify(paths));
