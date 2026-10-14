import * as THREE from 'three';

// 图二像素位置作为追踪基准；分段校准确保两处已知净宽同时成立。
const livingScale = 3.4 / (649 - 405);
const middleEnd = 3.52 + (840 - 661) * livingScale;
const anchors = [[399, -.1], [405, 0], [649, 3.4], [655, 3.46], [661, 3.52],
  [840, middleEnd], [846, middleEnd + .06], [852, middleEnd + .12],
  [1059, middleEnd + .12 + 3.2], [1065, middleEnd + .12 + 3.3]];
export function x(px) {
  let i = 0;
  while (i < anchors.length - 2 && px > anchors[i + 1][0]) i++;
  const [p, m] = anchors[i], [q, n] = anchors[i + 1];
  return m + (px - p) * (n - m) / (q - p);
}
export const wallHeight = 2.9;
export const totalArea = 98;

// X 已固定两处净宽，只校正未实测的进深，使含墙体和图内赠送空间的轮廓合计98㎡。
function outlineAtDepth(scale) {
  const depth = py => (py - 102) * scale;
  return [
  [x(402) - .1, -.1], [x(695) + .1, -.1],
  [x(695) + .1, depth(386) - .1], [x(1065) + .1, depth(386) - .1],
  [x(1065) + .1, depth(879) + .1], [x(899) + .06, depth(879) + .1],
  [x(899) + .06, depth(978) + .1], [x(399) - .1, depth(978) + .1],
  [x(399) - .1, depth(585) - .1], [x(430) - .1, depth(585) - .1],
  [x(430) - .1, depth(506) + .1], [x(374) - .1, depth(506) + .1],
  [x(374) - .1, depth(416) - .1], [x(402) - .1, depth(416) - .1]
  ];
}
function footprintArea(points) {
  return Math.abs(points.reduce((sum,[px,pz],i) => {
    const [nextX,nextZ] = points[(i+1)%points.length];
    return sum + px * nextZ - nextX * pz;
  },0)) / 2;
}
const referenceArea = footprintArea(outlineAtDepth(livingScale));
const doubleDepthArea = footprintArea(outlineAtDepth(livingScale * 2));
export const depthScale = livingScale + (totalArea - referenceArea) * livingScale / (doubleDepthArea - referenceArea);
export const depthCalibration = {referenceArea, targetArea:totalArea,
  depthFactor:depthScale/livingScale, method:'保持两处确认净宽，校正估算进深至含墙体总面积98㎡'};
export const z = py => (py - 102) * depthScale;

// 北侧红框为从玄关进入的小房间；南侧设备平台用途、墙厚及具体进深仍属估算。
export const outline = outlineAtDepth(depthScale);

const opening = (a, b, sill, top, kind, width) => ({a, b, sill, top, kind, width});
const door = (a, b, width = .8) => opening(a, b, 0, 2.1, 'door', width);
const windowHole = (a, b, sill = .9, top = 2.2) => opening(a, b, sill, top, 'window');

export const walls = [
  {name:'Exterior_North', axis:'h', at:102, a:402, b:695, t:.2},
  {name:'Exterior_Entrance_West', axis:'v', at:402, a:102, b:416, t:.2,
    holes:[opening(121, 189, 0, 2.2, 'entrance', .95)]},
  {name:'Exterior_Notch_North', axis:'h', at:416, a:374, b:430, t:.2},
  {name:'Exterior_Notch_West', axis:'v', at:374, a:416, b:506, t:.2},
  {name:'Exterior_Notch_South', axis:'h', at:506, a:374, b:430, t:.2},
  {name:'Exterior_Notch_Return', axis:'v', at:430, a:506, b:585, t:.2},
  {name:'Exterior_Living_Return', axis:'h', at:585, a:399, b:430, t:.2},
  {name:'Exterior_Living_West', axis:'v', at:399, a:585, b:978, t:.2},
  {name:'Exterior_Balcony_South', axis:'h', at:978, a:399, b:846, t:.2,
    holes:[windowHole(436, 608, .05, 2.5), windowHole(616, 798, .05, 2.5)]},
  {name:'Service_South_Parapet', axis:'h', at:978, a:846, b:899, t:.12, height:1.1},
  {name:'Service_East_Parapet', axis:'v', at:899, a:879, b:978, t:.12, height:1.1},
  {name:'Service_Balcony_Divider', axis:'v', at:846, a:879, b:978, t:.12},
  {name:'Exterior_Master_South', axis:'h', at:879, a:846, b:1065, t:.2,
    holes:[windowHole(906, 1019, .65, 2.25)]},
  {name:'Exterior_Master_East', axis:'v', at:1065, a:386, b:879, t:.2},
  {name:'Exterior_Rooms_North', axis:'h', at:386, a:695, b:1065, t:.2,
    holes:[windowHole(714, 763, 1.5, 2.3), windowHole(800, 901, .9, 2.25),
      windowHole(970, 1017, 1.5, 2.3)]},
  {name:'Exterior_Kitchen_East', axis:'v', at:695, a:276, b:431, t:.2,
    holes:[windowHole(284, 322, 1.0, 2.2)]},
  {name:'Exterior_Small_Room_East', axis:'v', at:695, a:102, b:276, t:.2},
  {name:'Entrance_Small_Room_Divider', axis:'v', at:526, a:102, b:326, t:.12,
    holes:[door(161, 217, .8)]},
  {name:'Kitchen_North', axis:'h', at:276, a:526, b:695, t:.12},
  // 厨房南侧面向餐厅为实墙，门洞位于面向玄关的西侧。
  {name:'Kitchen_West', axis:'v', at:526, a:326, b:431, t:.12,
    holes:[door(352, 408, .8)]},
  {name:'Kitchen_South', axis:'h', at:431, a:526, b:655, t:.12},
  {name:'Bath_West_Step', axis:'h', at:431, a:655, b:695, t:.12},
  {name:'Bath_West', axis:'v', at:655, a:431, b:581, t:.12},
  {name:'Bath_Guest_Divider', axis:'v', at:773, a:386, b:581, t:.12},
  {name:'Guest_Bath_Divider', axis:'v', at:951, a:386, b:581, t:.12},
  {name:'Bath_Guest_South', axis:'h', at:581, a:655, b:773, t:.12,
    holes:[door(714, 761, .7)]},
  {name:'Guest_North_South', axis:'h', at:581, a:773, b:951, t:.12,
    holes:[door(782, 837, .8)]},
  {name:'Bath_Master_South', axis:'h', at:581, a:951, b:1065, t:.12,
    holes:[door(958, 1011, .7)]},
  {name:'Master_West', axis:'v', at:846, a:581, b:879, t:.12,
    holes:[door(600, 654, .8)]},
  {name:'Guest_South_North', axis:'h', at:670, a:655, b:846, t:.12,
    holes:[door(661, 717, .8)]},
  {name:'Guest_South_West', axis:'v', at:655, a:670, b:865, t:.12},
  {name:'Guest_South_South', axis:'h', at:865, a:655, b:846, t:.12,
    holes:[windowHole(704, 798, .65, 2.25)]}
];

export const roomLabels = [
  ['玄关', 463, 249], ['厨房', 606, 351], ['餐厅', 532, 519],
  ['客厅', 525, 751], ['次卧', 744, 768], ['主卧', 953, 741],
  ['次卧', 862, 481], ['卫生间', 714, 477], ['卫生间', 1005, 478],
  ['阳台', 615, 923], ['小房间', 610, 185]
];

export const dimensions = [
  {name:'客厅净宽', value:3.4, a:[0, z(800)], b:[3.4, z(800)]},
  {name:'主卧净宽', value:3.2, a:[x(852), z(805)], b:[x(1059), z(805)]}
];

function material(name, color) {
  const result = new THREE.MeshStandardMaterial({color, roughness:.98, metalness:0});
  result.name = name;
  return result;
}

export function buildModel({edges = false} = {}) {
  const root = new THREE.Group();
  root.name = 'Apartment_Shell_Metres';
  root.userData = {source:'Reference image 2', units:'metres', wallHeight:2.9,
    livingClearWidth:3.4, masterClearWidth:3.2, totalArea,
    areaBasis:'floor outline including walls and visible gifted spaces', remainingDimensions:'estimated'};
  const wallMat = material('Unfinished_Plasters', 0xb8b5ae);
  const slabMat = material('Concrete_Slab', 0xaaa69f);
  const structure = new THREE.Group();
  structure.name = 'Walls_And_Openings';
  root.add(structure);
  const solids = [];
  const openings = [];

  function box(name, cx, cz, width, depth, base, top, mat = wallMat, host = structure) {
    if (width <= 1e-6 || depth <= 1e-6 || top <= base) return;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, top - base, depth), mat);
    mesh.name = name;
    mesh.position.set(cx, (base + top) / 2, cz);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData = {base, top, width, depth, estimated:true};
    if (edges) {
      const outlineMesh = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry),
        new THREE.LineBasicMaterial({color:0x6c6860, transparent:true, opacity:.36}));
      mesh.add(outlineMesh);
    }
    host.add(mesh);
    if (host === structure) solids.push(mesh);
    return mesh;
  }

  const shape = new THREE.Shape();
  outline.forEach(([px, py], i) => i ? shape.lineTo(px, -py) : shape.moveTo(px, -py));
  shape.closePath();
  const slabGeometry = new THREE.ExtrudeGeometry(shape, {depth:.16, bevelEnabled:false, steps:1});
  slabGeometry.rotateX(-Math.PI / 2);
  slabGeometry.translate(0, -.16, 0);
  const slab = new THREE.Mesh(slabGeometry, slabMat);
  slab.name = 'Floor_Slab';
  slab.receiveShadow = true;
  slab.userData = {thickness:.16, estimated:true};
  root.add(slab);

  walls.forEach(w => {
    const convert = w.axis === 'h' ? x : z;
    const low = convert(w.a), high = convert(w.b), height = w.height ?? wallHeight;
    const fixed = w.axis === 'h' ? z(w.at) : x(w.at);
    const holes = (w.holes ?? []).map(h => {
      const mid = (convert(h.a) + convert(h.b)) / 2;
      const width = h.width ?? (convert(h.b) - convert(h.a));
      return {...h, start:Math.max(low, mid - width / 2), end:Math.min(high, mid + width / 2)};
    }).sort((a, b) => a.start - b.start);
    function piece(a, b, base, top, suffix) {
      const center = (a + b) / 2;
      box(`${w.name}_${suffix}`, w.axis === 'h' ? center : fixed,
        w.axis === 'h' ? fixed : center, w.axis === 'h' ? b - a : w.t,
        w.axis === 'h' ? w.t : b - a, base, top);
    }
    let cursor = low;
    holes.forEach((h, i) => {
      piece(cursor, h.start, 0, height, `Pier_${i}`);
      if (h.sill > 0) piece(h.start, h.end, 0, h.sill, `Sill_${i}`);
      piece(h.start, h.end, h.top, height, `Lintel_${i}`);
      openings.push({wall:w.name, axis:w.axis, fixed, start:h.start, end:h.end,
        sill:h.sill, top:h.top, kind:h.kind, estimated:true});
      cursor = h.end;
    });
    piece(cursor, high, 0, height, 'End');
  });

  // 红框内原推测的管井和平台分隔取消，按用户确认还原为单个室内小房间。
  return {root, structure, solids, openings, slab};
}

export function setDisplayHeight(solids, height) {
  solids.forEach(mesh => {
    const {base, top} = mesh.userData;
    const clipped = Math.min(top, height);
    mesh.visible = clipped > base + 1e-5;
    if (mesh.visible) {
      mesh.scale.y = (clipped - base) / (top - base);
      mesh.position.y = (base + clipped) / 2;
    }
  });
}
