import fs from 'node:fs/promises';
import {x,z,outline} from './model.mjs';

const source=await fs.readFile(new URL('./interior.mjs',import.meta.url),'utf8');
const literal=source.match(/export const roomViews = (\[[\s\S]*?\n\]);/)[1];
const views=Function('x','z','return '+literal)(x,z);
const links={living:['dining','balcony','bedroom-south','master'],dining:['living','entrance','kitchen','bedroom-north','bath-west','bath-east'],
  entrance:['dining','kitchen','small-room'],kitchen:['entrance'],master:['living','bath-east'],
  'bedroom-south':['living'],'bedroom-north':['dining'],'small-room':['entrance'],balcony:['living'],
  'bath-west':['dining'],'bath-east':['dining','master']};
const points=views.map(view=>({...view,position:[view.position[0],1.55,view.position[2]],links:links[view.id]}));
await fs.writeFile(new URL('./panorama-points.json',import.meta.url),JSON.stringify(points,null,2));
await fs.writeFile(new URL('./panorama-map.json',import.meta.url),JSON.stringify({outline}));
console.log('Fixed viewpoints:',points.length);
