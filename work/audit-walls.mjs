import {buildModel, walls, outline, x, z} from './model.mjs';
import {areaReport} from './areas.mjs';

const groups = wall => wall.name.startsWith('Exterior_') ? 'external' :
  wall.name.startsWith('Service_') ? 'service' : 'internal';
const projected = walls.map(wall => {
  const half = wall.t/2;
  return {...(wall.axis === 'h' ?
    {x0:x(wall.a),x1:x(wall.b),z0:z(wall.at)-half,z1:z(wall.at)+half} :
    {x0:x(wall.at)-half,x1:x(wall.at)+half,z0:z(wall.a),z1:z(wall.b)}),
    group:groups(wall)};
});
const actual = buildModel().solids.filter(mesh => mesh.userData.base === 0).map(mesh => ({
  x0:mesh.position.x-mesh.userData.width/2,x1:mesh.position.x+mesh.userData.width/2,
  z0:mesh.position.z-mesh.userData.depth/2,z1:mesh.position.z+mesh.userData.depth/2
}));
const xs = new Set(outline.map(point=>point[0])), zs = new Set(outline.map(point=>point[1]));
[...projected,...actual].forEach(rect=>{xs.add(rect.x0);xs.add(rect.x1);zs.add(rect.z0);zs.add(rect.z1);});
const xCuts=[...xs].sort((a,b)=>a-b),zCuts=[...zs].sort((a,b)=>a-b);
function inside(px,pz) {
  let result=false;
  for(let i=0,j=outline.length-1;i<outline.length;j=i++) {
    const [ax,az]=outline[i],[bx,bz]=outline[j];
    if((az>pz)!==(bz>pz)&&px<(bx-ax)*(pz-az)/(bz-az)+ax) result=!result;
  }
  return result;
}
const has = (rect,px,pz) => px>rect.x0&&px<rect.x1&&pz>rect.z0&&pz<rect.z1;
const byGroup={external:0,internal:0,service:0};
let footprint=0,thresholds=0;
for(let i=0;i<xCuts.length-1;i++) for(let j=0;j<zCuts.length-1;j++) {
  const px=(xCuts[i]+xCuts[i+1])/2,pz=(zCuts[j]+zCuts[j+1])/2;
  if(!inside(px,pz)) continue;
  const area=(xCuts[i+1]-xCuts[i])*(zCuts[j+1]-zCuts[j]);
  const matched=projected.filter(rect=>has(rect,px,pz));
  if(!matched.length) continue;
  const group=['external','internal','service'].find(name=>matched.some(rect=>rect.group===name));
  byGroup[group]+=area;
  if(actual.some(rect=>has(rect,px,pz))) footprint+=area;
  else thresholds+=area;
}
const projection=Object.values(byGroup).reduce((a,b)=>a+b,0);
if(Math.abs(projection-areaReport.wallArea)>1e-8) throw new Error('Projection mismatch');
const rounded=value=>Number(value.toFixed(4));
console.log(JSON.stringify({assumedThickness:{external:.20,internal:.12,service:.12},
  fullProjection:rounded(projection),projectionByGroup:Object.fromEntries(Object.entries(byGroup).map(([key,value])=>[key,rounded(value)])),
  floorLevelWallFootprint:rounded(footprint),doorThresholdProjection:rounded(thresholds),
  projectionMatchesCurrentModel:true,measuredPropertyArea:false},null,2));
