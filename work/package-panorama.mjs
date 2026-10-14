import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import {outline,walls,buildModel,x,z} from './model.mjs';
import {canStand} from './walk.mjs';

const dir=path.dirname(fileURLToPath(import.meta.url));
const points=JSON.parse(await fs.readFile(path.join(dir,'panorama-points.json'),'utf8'));
const themes={warm:{name:'暖木现代'},minimal:{name:'清爽极简'},urban:{name:'都市深色'}};
const preview=process.argv.includes('--preview');
const web=process.argv.includes('--web');
if(web&&preview)throw new Error('线上发布必须包含全部点位，不能使用预览模式');
const webDir=path.join(dir,'../outputs/website');
if(web)await fs.mkdir(webDir,{recursive:true});
const ready=[];
for(const point of points){
  try{
    const images={};
    for(const theme of Object.keys(themes)){
      let source=path.join(dir,'panorama-render/v2',theme,point.id+'.jpg'),image;
      try{image=await fs.readFile(source);}catch(error){
        if(error.code!=='ENOENT')throw error;
        // Git检出包含已发布图片，重新打包不依赖本机Blender缓存。
        source=path.join(webDir,'panoramas',theme,point.id+'.jpg');image=await fs.readFile(source);
      }
      if(web){
        // 线上按需请求当前房间，所有资源使用相对路径，支持站点子目录。
        images[theme]='panoramas/'+theme+'/'+point.id+'.jpg';
        await fs.mkdir(path.join(webDir,'panoramas',theme),{recursive:true});
        const target=path.join(webDir,images[theme]);
        if(source!==target)await fs.copyFile(source,target);
      }else images[theme]='data:image/jpeg;base64,'+image.toString('base64');
    }
    ready.push({...point,images});
  }catch(error){if(!preview||error.code!=='ENOENT')throw error;}
}
if(!ready.length)throw new Error('尚无完成的全景图片');
const anchors={};
const openings=buildModel().openings;
function door(a,b,name){const hole=openings.find(h=>h.wall===name&&h.kind==='door');const p=hole.axis==='h'?[(hole.start+hole.end)/2,hole.fixed]:[hole.fixed,(hole.start+hole.end)/2];anchors[a+'>'+b]=anchors[b+'>'+a]=p;}
door('entrance','small-room','Entrance_Small_Room_Divider');door('entrance','kitchen','Kitchen_West');
door('dining','kitchen','Kitchen_West');door('dining','bath-west','Bath_Guest_South');door('dining','bath-east','Bath_Master_South');
door('dining','bedroom-north','Guest_North_South');door('living','bedroom-south','Guest_South_North');door('living','master','Master_West');
anchors['living>dining']=[1.65,6.9];anchors['dining>living']=[1.5,7.2];anchors['living>balcony']=[1.7,11.25];anchors['balcony>living']=[1.6,10.6];
const capture=JSON.parse((await fs.readFile(path.join(dir,'furnished-world.json'),'utf8')).replace(/^\uFEFF/,''));
const world=capture.data.result.world,hotspotPositions={};
for(const point of points)for(const id of point.links){
  const target=points.find(p=>p.id===id),anchor=anchors[point.id+'>'+id]||[target.position[0],target.position[2]];
  const dx=anchor[0]-point.position[0],dz=anchor[1]-point.position[2],distance=Math.hypot(dx,dz);
  let free=0;for(let step=.05;step<=Math.min(distance,1.7);step+=.05){
    if(!canStand(world,point.position[0]+dx*step/distance,point.position[2]+dz*step/distance,.07))break;free=step;
  }
  if(free>.4){const length=Math.max(.3,free-.12);hotspotPositions[point.id+'>'+id]=[dx*length/distance,-point.position[1]+.035,dz*length/distance];}
}
const tour=JSON.stringify({points:ready,themes,outline,hotspotPositions,walls:walls.map(w=>w.axis==='h'?[x(w.a),z(w.at),x(w.b),z(w.at)]:[x(w.at),z(w.a),x(w.at),z(w.b)])});
// 发布数据只覆盖本次打包的JSON模块，避免改变原离线版的数据文件。
const plugins=web?[{name:'web-tour',setup(builder){
  builder.onResolve({filter:/^\.\/panorama-tour\.json$/},()=>({path:'panorama-tour',namespace:'web-tour'}));
  builder.onLoad({filter:/.*/,namespace:'web-tour'},()=>({contents:tour,loader:'json'}));
}}]:[];
if(!web)await fs.writeFile(path.join(dir,'panorama-tour.json'),tour);
const result=await build({entryPoints:[path.join(dir,'panorama-viewer.mjs')],bundle:true,write:false,format:'iife',minify:true,target:['es2020'],plugins});
const template=await fs.readFile(path.join(dir,'panorama-template.html'),'utf8');
await fs.writeFile(web?path.join(webDir,'apartment-panorama.html'):path.join(dir,preview?'panorama-preview.html':'../outputs/apartment-panorama.html'),template.replace('/*BUNDLED_SCRIPT*/',()=>result.outputFiles[0].text.replace(/<\/script/gi,'<\\/script')));
if(web){
  for(const [source,target] of [['website-index.html','index.html'],['website-deploy.txt','部署说明.txt']])await fs.copyFile(path.join(dir,source),path.join(webDir,target));
  for(const name of ['apartment-viewer.html','素材来源与许可.md'])await fs.copyFile(path.join(dir,'../outputs',name),path.join(webDir,name));
}
console.log('Panorama page:',ready.length,'viewpoints ×',Object.keys(themes).length,'themes;',result.outputFiles[0].contents.byteLength,'script bytes');
