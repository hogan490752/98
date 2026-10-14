import {outline, walls} from './model.mjs';

export const person = {radius:.18, height:1.8, eyeHeight:1.62};

// 碰撞取完整墙体的平面边界，不受总览剖切显示影响；门楣高于人头，可通行。
export function createWalkWorld(model) {
  const boxes = model.solids.filter(mesh => mesh.userData.base < person.height && mesh.userData.top > .15)
    .map(mesh => ({minX:mesh.position.x - mesh.userData.width / 2,
      maxX:mesh.position.x + mesh.userData.width / 2,
      minZ:mesh.position.z - mesh.userData.depth / 2,
      maxZ:mesh.position.z + mesh.userData.depth / 2}));
  // 窗洞不能作为通道，防止穿出阳台落地窗或翻越窗台。
  model.openings.filter(hole => hole.kind === 'window').forEach(hole => {
    const half = walls.find(w => w.name === hole.wall).t / 2;
    boxes.push(hole.axis === 'h' ?
      {minX:hole.start, maxX:hole.end, minZ:hole.fixed - half, maxZ:hole.fixed + half} :
      {minX:hole.fixed - half, maxX:hole.fixed + half, minZ:hole.start, maxZ:hole.end});
  });
  return {boxes, polygon:outline};
}

function insidePolygon(px, pz, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [ax, az] = polygon[i], [bx, bz] = polygon[j];
    if ((az > pz) !== (bz > pz) && px < (bx - ax) * (pz - az) / (bz - az) + ax) inside = !inside;
  }
  return inside;
}

export function canStand(world, px, pz, radius = person.radius) {
  for (const box of world.boxes) {
    const dx = px - Math.max(box.minX, Math.min(box.maxX, px));
    const dz = pz - Math.max(box.minZ, Math.min(box.maxZ, pz));
    if (dx * dx + dz * dz < radius * radius) return false;
  }
  for (let i = 0; i < 8; i++) {
    const angle = i * Math.PI / 4;
    if (!insidePolygon(px + Math.cos(angle) * radius, pz + Math.sin(angle) * radius, world.polygon)) return false;
  }
  return true;
}

export function moveWithCollisions(world, position, dx, dz) {
  // 分小步推进避免低帧率下跨过薄墙；分别处理两轴，允许沿墙滑动。
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / .045));
  let px = position.x, pz = position.z;
  for (let i = 0; i < steps; i++) {
    const nextX = px + dx / steps;
    if (canStand(world, nextX, pz)) px = nextX;
    const nextZ = pz + dz / steps;
    if (canStand(world, px, nextZ)) pz = nextZ;
  }
  return {x:px, z:pz};
}
