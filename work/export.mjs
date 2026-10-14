import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {OBJExporter} from 'three/addons/exporters/OBJExporter.js';
import {buildModel, x, z, outline, dimensions, walls, depthCalibration} from './model.mjs';
import {areaReport, displayedSpaces} from './areas.mjs';

// 无贴图的 GLB 导出只需在 Node 中实现 Blob 的 ArrayBuffer 读取。
globalThis.FileReader = class {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then(result => {this.result = result; this.onloadend?.();})
      .catch(error => this.onerror?.(error));
  }
};
const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../outputs');
await fs.mkdir(dir, {recursive:true});
const {root, openings, solids} = buildModel();
root.updateMatrixWorld(true);
const glb = await new GLTFExporter().parseAsync(root, {binary:true});
await fs.writeFile(path.join(dir, 'apartment-shell.glb'), Buffer.from(glb));
await fs.writeFile(path.join(dir, 'apartment-shell.obj'),
  '# Units: metres; Y up; source: reference image 2\nmtllib apartment-shell.mtl\n' + new OBJExporter().parse(root));
const materials = new Map();
root.traverse(object => {if (object.isMesh) materials.set(object.material.name, object.material);});
const mtl = [...materials].map(([name, material]) => {
  const rgb = material.color.clone().convertLinearToSRGB();
  return `newmtl ${name}\nKa 0.2 0.2 0.2\nKd ${rgb.r} ${rgb.g} ${rgb.b}\nKs 0 0 0\nNs 1\nd 1\nillum 2\n`;
}).join('\n');
await fs.writeFile(path.join(dir, 'apartment-shell.mtl'), mtl);

const livingWidth = 3.46 - .06 - 0;
const masterWidth = x(1065) - .1 - (x(846) + .06);
if (Math.abs(livingWidth - 3.4) > 1e-8 || Math.abs(masterWidth - 3.2) > 1e-8) {
  throw new Error(`Width mismatch: ${livingWidth}, ${masterWidth}`);
}
for (const hole of openings) {
  if (!(hole.end > hole.start && hole.top > hole.sill && hole.top <= 2.9)) {
    throw new Error(`Invalid opening: ${hole.wall}`);
  }
}
const metadata = {
  version:5, source:'图二', units:'米', axes:'Y 向上；图二上方为北，模型 Z 负方向为北',
  confirmed:{wallHeight:2.9, livingClearWidth:3.4, masterClearWidth:3.2,
    northAreaUse:'用户红框指示的北侧区域为室内小房间',
    smallRoomEntrance:'从玄关进入',
    kitchenEntrance:'从玄关进入；面向餐厅为完整隔墙',
    refrigeratorLocation:'客餐厅侧向外凸出的凹位；不放在厨房内',
    areaDisplay:'用户确认98㎡总面积包含墙体和赠送空间；模型按这个总面积校准'},
  assumptions:{
    widthDirection:'客厅与主卧的宽度均解释为图二左右方向的净宽',
    calibration:'X 分段校准两处净宽；Z 方向在图面比例基础上校正进深，使含墙体总面积为98㎡',
    outerWallThickness:.2, innerWallThickness:.12, slabThickness:.16,
    doorHeight:2.1, entranceHeight:2.2, windowSills:'0.05–1.50，依据位置估算',
    platforms:'仅南侧未命名区域暂按设备平台处理，栏墙高 1.10；北侧红框区域已确认为小房间',
    ceiling:'模型无顶板以便查看；2.90 作为建模墙高，未扣除实际楼板厚度'
  },
  check:{livingClearWidth:livingWidth, masterClearWidth:masterWidth,
    fullHeight:Math.max(...solids.map(s => s.userData.top)),
    wallSolids:solids.length, openings:openings.length,
    footprintArea:areaReport.footprintArea, spacesArea:areaReport.netArea, wallsArea:areaReport.wallArea},
  footprint:outline, dimensions, wallLayout:walls, openings,
  areaReport, depthCalibration,
  note:'保持两处确认净宽和墙高，校准估算进深至总面积98㎡。各空间地面面积与墙体单独记录，图内赠送空间纳入对应区域，不另加面积。'
};
await fs.writeFile(path.join(dir, 'model-dimensions.json'), JSON.stringify(metadata, null, 2));
await fs.writeFile(path.join(dir, 'area-breakdown.json'), JSON.stringify(areaReport, null, 2));
const areaRows = displayedSpaces.map(space =>
  `| ${space.name} | ${space.netDisplay.toFixed(2)} |`).join('\n');
const areaDocument = `# 户型各空间面积\n\n用户确认 **98㎡包含墙体和赠送空间**。模型总轮廓已校准到 **98.00㎡**。\n\n` +
  `| 空间 | 地面面积（㎡，不含墙体） |\n|---|---:|\n${areaRows}\n` +
  `| **空间地面合计** | **${areaReport.netDisplayTotal.toFixed(2)}** |\n` +
  `| **墙体投影（含门槛）** | **${areaReport.wallDisplay.toFixed(2)}** |\n` +
  `| **总面积（含墙体）** | **98.00** |\n\n` +
  `已保留客厅 3.40 米、主卧 3.20 米净宽和墙高 2.90 米；在图面比例的基础上，将未实测进深校正约 ` +
  `${((depthCalibration.depthFactor-1)*100).toFixed(2)}%，使模型几何本身达到98㎡。\n\n` +
  `模型净面积按墙内侧估算；完整墙体投影（包括门洞门槛）从轮廓内扣除。` +
  `客餐厅、玄关和过道为开放空间，按图示位置划区；阳台与设备位按完整模型地面估算。\n\n` +
  `图内赠送空间包含在对应区域中，不另行重复加面积；具体赠送边界尚需销售图纸确认。` +
  `模型按完整外墙投影表达，未按产权测绘的共用墙分摊规则计算。这些面积仍为建模估算，不代表实测或产权测绘结果。\n`;
await fs.writeFile(path.join(dir, '空间面积明细.md'), areaDocument);
console.log(JSON.stringify({glbBytes:glb.byteLength, ...metadata.check}, null, 2));
