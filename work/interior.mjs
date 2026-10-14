import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {Reflector} from 'three/addons/objects/Reflector.js';
import {x,z} from './model.mjs';
import woodData from './interior-assets/wood_floor.json';
import stoneData from './interior-assets/marble_01.json';
import linenData from './interior-assets/rough_linen.json';
import chairData from './interior-assets/dining_chair_02.json';
import armchairData from './interior-assets/modern_arm_chair_01.json';
import plantData from './interior-assets/potted_plant_01.json';
import coffeeData from './interior-assets/modern_coffee_table_01.json';
import sofaData from './realism-assets/sofa.json';
import neutralLinen from './realism-assets/neutral-linen.json';
import {decodeBinary} from './realism.mjs';

export const themes = {
  warm:{name:'暖木现代',subtitle:'浅橡木 · 亚麻 · 鼠尾草绿',paint:'#f1ece3',wood:'#e0c19b',
    floor:'#ffffff',floorType:'wood',fabric:'#dcd4c4',bedding:'#ded4c0',accent:'#6d8374',cabinet:'#e4dfd4',metal:'#b79b6c',stone:'#f1eee5'},
  minimal:{name:'清爽极简',subtitle:'浅色石材 · 柔白 · 石墨灰',paint:'#f0f1ed',wood:'#d4d0c2',
    floor:'#e8e8e3',floorType:'stone',fabric:'#e1e3df',bedding:'#d4d9d7',accent:'#6b7c85',cabinet:'#e8eae6',metal:'#666f72',stone:'#f5f5f0'},
  urban:{name:'都市深色',subtitle:'深木色 · 暖灰 · 焦糖皮革',paint:'#c6c7bd',wood:'#846144',
    floor:'#a58a70',floorType:'wood',fabric:'#a16f4f',bedding:'#858b88',accent:'#394b4c',cabinet:'#515957',metal:'#b7a27b',stone:'#b9b6aa'}
};

export const roomViews = [
  {id:'living',name:'客厅',position:[.62,1.62,z(621)],look:[2.1,1.05,z(792)]},
  {id:'dining',name:'餐厅',position:[.83,1.62,z(568)],look:[2.07,1.08,z(502)]},
  {id:'kitchen',name:'厨房',position:[x(567),1.62,z(398)],look:[x(679),1.22,z(306)]},
  {id:'master',name:'主卧',position:[x(900),1.62,z(675)],look:[x(1020),1.08,z(800)]},
  {id:'bedroom-south',name:'次卧1',position:[x(691),1.62,z(697)],look:[x(802),1.06,z(800)]},
  {id:'bedroom-north',name:'次卧2',position:[x(805),1.62,z(555)],look:[x(908),1.05,z(452)]},
  {id:'small-room',name:'小房间',position:[x(589),1.62,z(246)],look:[x(617),1.15,z(130)]},
  {id:'balcony',name:'阳台',position:[x(604),1.62,z(904)],look:[x(473),1.12,z(963)]},
  {id:'bath-west',name:'卫1',position:[4.64,1.62,6.57],look:[4.10,1.15,5.64]},
  {id:'bath-east',name:'卫2',position:[8.16,1.62,6.57],look:[8.81,1.15,5.64]},
  {id:'entrance',name:'玄关',position:[x(468),1.62,z(233)],look:[x(476),1.14,z(370)]}
];

function makeTexture(data,role,repeat=1) {
  const uri=data[role];
  if(!uri) return null;
  const texture=new THREE.TextureLoader().load(uri);
  texture.colorSpace=role==='diff'?THREE.SRGBColorSpace:THREE.NoColorSpace;
  texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
  texture.repeat.set(repeat,repeat);
  texture.anisotropy=4;
  return texture;
}

export function createInterior({model,scene,ceiling}) {
  const group=new THREE.Group();group.name='装修与家具';scene.add(group);
  const architecture=new THREE.Group();architecture.name='饰面与灯具';group.add(architecture);
  const furnishings=new THREE.Group();furnishings.name='可调整家具';group.add(furnishings);
  const woodMap=makeTexture(woodData,'diff',1),woodNormal=makeTexture(woodData,'nor_gl',1);
  const floorMap=makeTexture(woodData,'diff',1),floorNormal=makeTexture(woodData,'nor_gl',1);
  const stoneMap=makeTexture(stoneData,'diff',.65),stoneNormal=makeTexture(stoneData,'nor_gl',.65);
  // 中性化扫描布纹保留真实织物细节，同时允许方案准确配色。
  const fabricMap=makeTexture(neutralLinen,'diff',2);
  const fabricNormal=makeTexture(linenData,'nor_gl',2),fabricRough=makeTexture(linenData,'rough',2);
  const m={
    paint:new THREE.MeshStandardMaterial({color:0xf1ece3,roughness:.91}),
    wood:new THREE.MeshStandardMaterial({color:0xe0c19b,map:woodMap,normalMap:woodNormal,normalScale:new THREE.Vector2(.18,.18),roughness:.53}),
    floor:new THREE.MeshStandardMaterial({color:0xffffff,map:floorMap,normalMap:floorNormal,normalScale:new THREE.Vector2(.12,.12),roughness:.68}),
    fabric:new THREE.MeshPhysicalMaterial({color:0xdcd4c4,map:fabricMap,normalMap:fabricNormal,roughnessMap:fabricRough,normalScale:new THREE.Vector2(.08,.08),roughness:.95,sheen:.35,sheenRoughness:.8}),
    seam:new THREE.MeshStandardMaterial({color:0xb5ac9b,roughness:.95}),
    bedding:new THREE.MeshPhysicalMaterial({color:0xded4c0,map:fabricMap,normalMap:fabricNormal,roughnessMap:fabricRough,normalScale:new THREE.Vector2(.08,.08),roughness:1,sheen:.25}),
    accent:new THREE.MeshStandardMaterial({color:0x6d8374,roughness:.8}),
    cabinet:new THREE.MeshStandardMaterial({color:0xe4dfd4,roughness:.5}),
    metal:new THREE.MeshStandardMaterial({color:0xb79b6c,metalness:.83,roughness:.28}),
    stone:new THREE.MeshStandardMaterial({color:0xf1eee5,map:stoneMap,normalMap:stoneNormal,normalScale:new THREE.Vector2(.12,.12),roughness:.27}),
    tile:new THREE.MeshStandardMaterial({color:0xe9e7e0,map:stoneMap,roughness:.56}),
    wetWall:new THREE.MeshStandardMaterial({color:0xe6e9e3,roughness:.56}),
    white:new THREE.MeshStandardMaterial({color:0xf0f1ec,roughness:.34}),
    dark:new THREE.MeshStandardMaterial({color:0x252b29,roughness:.34,metalness:.14}),
    green:new THREE.MeshStandardMaterial({color:0x31583f,roughness:.85,side:THREE.DoubleSide}),
    glass:new THREE.MeshPhysicalMaterial({color:0xe5eeec,transparent:true,opacity:.035,roughness:.035,metalness:0,depthWrite:false,side:THREE.DoubleSide}),
    slidingGlass:new THREE.MeshPhysicalMaterial({color:0xc8ddd8,transparent:true,opacity:.30,roughness:.12,metalness:.05,depthWrite:false,side:THREE.DoubleSide}),
    mirror:new THREE.MeshStandardMaterial({color:0xdbe0de,metalness:1,roughness:.055}),
    sheer:new THREE.MeshStandardMaterial({color:0xf0eee7,transparent:true,opacity:.67,roughness:1,depthWrite:false,side:THREE.DoubleSide}),
    light:new THREE.MeshStandardMaterial({color:0xffe9c9,emissive:0xffc981,emissiveIntensity:.55,roughness:.35})
  };
  m.accentFabric=m.fabric.clone();m.accentFabric.color=m.accent.color;
  Object.entries(m).forEach(([name,material])=>material.name='装修_'+name);
  const rawWalls=new Map(model.solids.map(mesh=>[mesh,mesh.material]));
  const rawFloor=model.slab.material,rawCeiling=ceiling.material;
  const pieces=[],doors=[],roomLights=[],bathFootprints=[],mirrors=[],bakedMaterials=new Map();
  let raw=false,currentTheme='warm';
  const geometryCache=new Map();
  function mesh(geometry,material,parent,position=[0,0,0]) {
    const item=new THREE.Mesh(geometry,material);item.position.set(...position);
    item.castShadow=true;item.receiveShadow=true;parent.add(item);return item;
  }
  function box(parent,w,h,d,material,px=0,py=h/2,pz=0,radius=.012) {
    const key=[w,h,d,radius].join(':');
    let geometry=geometryCache.get(key);
    if(!geometry){geometry=radius?new RoundedBoxGeometry(w,h,d,2,Math.min(radius,w/3,h/3,d/3)):new THREE.BoxGeometry(w,h,d);geometryCache.set(key,geometry);}
    return mesh(geometry,material,parent,[px,py,pz]);
  }
  function cylinder(parent,radius,height,material,px,py,pz,segments=24) {
    return mesh(new THREE.CylinderGeometry(radius,radius,height,segments),material,parent,[px,py,pz]);
  }
  function sphere(parent,w,h,d,material,px,py,pz) {
    const item=mesh(new THREE.SphereGeometry(1,20,12),material,parent,[px,py,pz]);item.scale.set(w,h,d);return item;
  }
  function piece(id,name,px,pz,w,d,rotation=0,collidable=true) {
    const item=new THREE.Group();item.name=name;item.position.set(px,0,pz);item.rotation.y=rotation;
    item.userData={id,name,width:w,depth:d,editable:true,collidable};
    furnishings.add(item);pieces.push(item);return item;
  }
  function floor(points,material) {
    const shape=new THREE.Shape();points.forEach(([px,pz],i)=>i?shape.lineTo(px,-pz):shape.moveTo(px,-pz));shape.closePath();
    const geometry=new THREE.ShapeGeometry(shape);geometry.rotateX(-Math.PI/2);
    const item=mesh(geometry,material,architecture,[0,.008,0]);item.castShadow=false;return item;
  }
  function rectFloor(x0,x1,z0,z1,material) {return floor([[x0,z0],[x1,z0],[x1,z1],[x0,z1]],material);}
  rectFloor(x(526)+.06,x(695)-.1,z(276)+.06,z(431)-.06,m.tile);
  floor([[x(655)+.06,z(431)+.06],[x(695)+.1,z(431)+.06],[x(695)+.1,z(386)+.1],
    [x(773)-.06,z(386)+.1],[x(773)-.06,z(581)-.06],[x(655)+.06,z(581)-.06]],m.tile);
  rectFloor(x(951)+.06,x(1065)-.1,z(386)+.1,z(581)-.06,m.tile);
  rectFloor(0,x(846)-.06,z(865)+.06,z(978)-.1,m.tile);

  // 踢脚线仅沿实体墙段生成，保留门洞和低窗洞。
  model.solids.filter(item=>item.userData.base===0&&item.userData.top>.2).forEach(item=>{
    const {width,depth}=item.userData;
    if(width>depth){box(architecture,width,.075,.018,m.white,item.position.x,.04,item.position.z-depth/2-.006,.004);
      box(architecture,width,.075,.018,m.white,item.position.x,.04,item.position.z+depth/2+.006,.004);}
    else{box(architecture,.018,.075,depth,m.white,item.position.x-width/2-.006,.04,item.position.z,.004);
      box(architecture,.018,.075,depth,m.white,item.position.x+width/2+.006,.04,item.position.z,.004);}
  });

  // 窗框、玻璃及自动开合的门扇，按已有洞口定位。
  model.openings.forEach((hole,index)=>{
    const width=hole.end-hole.start,center=(hole.start+hole.end)/2,height=hole.top-hole.sill;
    const frame=new THREE.Group();frame.position.set(hole.axis==='h'?center:hole.fixed,hole.sill,hole.axis==='h'?hole.fixed:center);
    frame.rotation.y=hole.axis==='h'?0:Math.PI/2;architecture.add(frame);
    const isWindow=hole.kind==='window',isKitchen=hole.wall==='Kitchen_West',mat=isWindow||isKitchen?m.dark:m.wood;
    box(frame,width+.07,.05,.065,mat,0,height+.018,0,.005);
    box(frame,.05,height,.065,mat,-width/2-.012,height/2,0,.004);
    box(frame,.05,height,.065,mat,width/2+.012,height/2,0,.004);
    if(isWindow){
      const pane=box(frame,width,height,.008,m.glass,0,height/2,0,0);pane.castShadow=false;
      box(frame,width,.035,.07,m.dark,0,.018,0,.003);
      if(width>1.15) box(frame,.025,height,.07,m.dark,0,height/2,0,.003);
      if(width>1.20&&hole.sill<1.2){
        const inward=hole.wall.includes('North')?.12:-.12;
        const rod=cylinder(frame,.012,width+.23,m.metal,0,2.70-hole.sill,inward,12);rod.rotation.z=Math.PI/2;
        for(const side of [-1,1]){
          const geometry=new THREE.PlaneGeometry(.43,2.46,20,1),position=geometry.attributes.position;
          for(let i=0;i<position.count;i++)position.setZ(i,Math.sin(position.getX(i)/.43*Math.PI*10)*.021);
          geometry.computeVertexNormals();
          const curtain=mesh(geometry,m.sheer,frame,[side*(width/2-.035),1.45-hole.sill,inward]);curtain.castShadow=false;
        }
      }
    }else if(isKitchen){
      // 门扇沿玄关侧墙面向北滑动，开启后不占厨房操作通道。
      const hinge=new THREE.Group();hinge.position.z=-.10;frame.add(hinge);
      const leafWidth=width+.06,leafHeight=height-.035;
      const pane=box(hinge,leafWidth-.05,leafHeight-.05,.009,m.slidingGlass,0,height/2,0,0);pane.castShadow=false;
      for(const side of [-1,1]){
        box(hinge,.025,leafHeight,.035,m.dark,side*(leafWidth/2-.0125),height/2,0,.002);
        box(hinge,leafWidth,.025,.035,m.dark,0,side<0?.025:height-.025,0,.002);
        box(hinge,.014,.28,.025,m.metal,-leafWidth/2+.10,1.02,side*.033,.003);
      }
      box(frame,width*2+.18,.045,.065,m.dark,(width+.10)/2,height+.068,-.10,.003);
      hinge.name='Kitchen_Sliding_Glass_Door';hinge.userData={doorType:'sliding-glass'};
      doors.push({hinge,frame,hole,type:'slide',distance:width+.10,offset:0,angle:0});
    }else if(hole.kind==='door'||hole.kind==='entrance'){
      const reverse=hole.wall==='Bath_Guest_South',side=reverse?-1:1;
      const hinge=new THREE.Group();hinge.position.x=-side*width/2;frame.add(hinge);
      box(hinge,width-.035,height-.035,.037,hole.kind==='entrance'?m.dark:m.cabinet,side*width/2,height/2,0,.007);
      box(hinge,width-.17,.016,.045,m.wood,side*width/2,.20,0,.003);
      cylinder(hinge,.012,.10,m.metal,side*(width-.12),.99,.046,12).rotation.z=Math.PI/2;
      // 西卫门改右侧铰链，打开后贴右墙，避免挡住左侧洗手台。
      const swing=reverse?-1:['Bath_Guest_South','Guest_North_South','Bath_Master_South'].includes(hole.wall)?1:-1;
      doors.push({hinge,frame,hole,angle:0,swing});
    }
  });

  function lamp(parent,px,py,pz,scale=1) {
    cylinder(parent,.11*scale,.025*scale,m.metal,px,py+.014*scale,pz);
    cylinder(parent,.012*scale,.30*scale,m.metal,px,py+.17*scale,pz);
    const shade=mesh(new THREE.ConeGeometry(.18*scale,.23*scale,32,1,true),m.fabric,parent,[px,py+.40*scale,pz]);
    shade.material.side=THREE.DoubleSide;
    sphere(parent,.07*scale,.07*scale,.07*scale,m.light,px,py+.34*scale,pz);
  }
  function plant(id,px,pz,height=1.3) {
    const item=piece(id,'绿植',px,pz,.32,.32,0,true);
    mesh(new THREE.CylinderGeometry(.14,.105,.29,32),m.cabinet,item,[0,.155,0]);
    let seed=id.length*711;
    for(let i=0;i<14;i++){
      seed=(Math.imul(seed,1664525)+1013904223)|0;
      const a=i*2.399,reach=.15+(seed>>>24)/255*.17,y=.40+i/14*(height-.50);
      const leaf=sphere(item,.045,.18,.009,m.green,Math.cos(a)*reach,y,Math.sin(a)*reach);
      leaf.rotation.set(.35,a,.55);
      const target=new THREE.Vector3(Math.cos(a)*reach,y,Math.sin(a)*reach);
      const stem=cylinder(item,.004,target.length()-.2,m.green,0,.3,0,6);
      stem.position.copy(target).multiplyScalar(.5);stem.position.y+=.1;
      stem.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),target.clone().normalize());
    }
    return item;
  }
  function art(parent,px,py,pz,w,h,rotation=0) {
    const panel=new THREE.Group();panel.position.set(px,py,pz);panel.rotation.y=rotation;parent.add(panel);
    box(panel,w,h,.025,m.wood,0,0,0,.005);
    box(panel,w-.04,h-.04,.009,m.white,0,0,.018,0);
    sphere(panel,w*.28,h*.25,.008,m.accent,-w*.12,h*.04,.03);
    box(panel,w*.25,h*.50,.015,m.wood,w*.19,-h*.03,.03,.025);
    return panel;
  }

  const sofa=piece('sofa','客厅沙发',2.83,z(744),2.25,.84,-Math.PI/2);
  box(sofa,2.22,.22,.80,m.fabric,0,.34,0,.10);
  for(const sx of [-1.01,1.01]) box(sofa,.18,.48,.85,m.fabric,sx,.53,0,.075);
  box(sofa,1.96,.52,.18,m.fabric,0,.64,-.32,.085);
  for(const sx of [-.52,.52]) box(sofa,.97,.13,.62,m.fabric,sx,.50,.075,.06);
  for(const sx of [-.87,.87]) for(const sz of [-.28,.28]) cylinder(sofa,.025,.20,m.wood,sx,.13,sz,12);
  const pillow=box(sofa,.41,.39,.12,m.accent,-.67,.80,-.18,.09);pillow.rotation.z=.18;
  const pillow2=box(sofa,.40,.37,.12,m.bedding,.67,.79,-.18,.08);pillow2.rotation.z=-.16;

  const rug=piece('rug','客厅地毯',1.76,z(760),2.72,2.70,0,false);
  box(rug,2.72,.012,2.70,m.bedding,0,.018,0,.005);
  const coffee=piece('coffee','茶几',1.55,z(760),1.10,.66,0,true);
  box(coffee,1.10,.055,.66,m.stone,0,.36,0,.008);
  box(coffee,.42,.31,.34,m.wood,0,.19,0,.006);
  box(coffee,.30,.025,.21,m.accent,-.15,.405,.02,.004);
  cylinder(coffee,.055,.055,m.white,.23,.423,-.04,24);

  const console=piece('tv-console','电视柜',.20,z(760),1.80,.32,Math.PI/2);
  box(console,1.8,.37,.32,m.wood,0,.25,0,.014);
  for(const dx of [-.55,0,.55]) box(console,.50,.28,.017,m.cabinet,dx,.27,.168,.007);
  box(console,1.42,.79,.036,m.dark,0,1.28,-.09,.015);
  const screenMat=new THREE.MeshPhysicalMaterial({color:0x303d37,metalness:.25,roughness:.1,clearcoat:1});
  box(console,1.35,.72,.008,screenMat,0,1.28,-.064,.008);
  art(architecture,.026,1.62,z(705),.68,.88,Math.PI/2);
  plant('living-plant',.43,z(862),1.55);

  const dining=piece('dining-table','餐桌',1.93,z(516),1.40,.82);
  box(dining,1.40,.045,.82,m.stone,0,.76,0,.008);
  box(dining,.46,.71,.34,m.wood,0,.385,0,.006);
  for(const sx of [-.37,.37]) for(const side of [-1,1]) {
    const chair=piece(`dining-chair-${sx}-${side}`,'餐椅',1.93+sx,z(516)+side*.70,.46,.49,side<0?0:Math.PI);
    box(chair,.45,.10,.43,m.fabric,0,.45,0,.045);
    box(chair,.42,.43,.065,m.fabric,0,.70,-.19,.035);
    for(const dx of [-.17,.17]) for(const dz of [-.16,.16]) cylinder(chair,.016,.40,m.wood,dx,.22,dz,10);
  }
  const vase=cylinder(dining,.067,.22,m.white,0,.89,0,24);
  sphere(dining,.09,.03,.09,m.accent,.26,.80,.05);
  cylinder(architecture,.028,.66,m.metal,1.93,2.57,z(516),12);
  sphere(architecture,.20,.14,.20,m.light,1.93,2.19,z(516));

  const shoe=piece('shoe-cabinet','玄关鞋柜',.23,z(297),1.05,.31,Math.PI/2);
  box(shoe,1.05,.89,.31,m.wood,0,.465,0,.015);
  for(const dx of [-.27,.27]) box(shoe,.51,.78,.02,m.cabinet,dx,.49,.168,.005);
  art(architecture,.025,1.68,z(285),.74,.90,Math.PI/2);

  const desk=piece('study-desk','小房间书桌',x(617),z(128),1.43,.52);
  box(desk,1.43,.045,.52,m.wood,0,.76,0,.009);
  for(const dx of [-.61,.61]) box(desk,.04,.71,.41,m.metal,dx,.385,0,.005);
  box(desk,.43,.28,.035,m.dark,-.16,1.00,-.09,.005);
  box(desk,.18,.025,.12,m.dark,-.16,.79,-.08,.003);
  lamp(desk,.48,.79,-.06,.65);
  const studyChair=piece('study-chair','书桌椅',x(617),z(190),.48,.48);
  box(studyChair,.47,.095,.45,m.accent,0,.46,0,.045);
  box(studyChair,.43,.44,.08,m.accent,0,.71,.20,.035);
  cylinder(studyChair,.035,.40,m.dark,0,.22,0,12);
  const shelf=piece('study-shelf','书架',x(676),z(199),.83,.29,-Math.PI/2);
  box(shelf,.83,2.18,.045,m.wood,0,1.13,-.13,.003);
  for(const sx of [-.39,.39]) box(shelf,.045,2.18,.29,m.wood,sx,1.13,0,.003);
  for(const yy of [.18,.62,1.06,1.50,1.98]) box(shelf,.81,.035,.29,m.wood,0,yy,0,.003);
  for(let i=0;i<10;i++) box(shelf,.038,.21+(i%3)*.025,.16,i%2?m.accent:m.cabinet,-.29+i*.06,.74,.02,.002);

  function bed(id,name,px,pz,width,depth) {
    const item=piece(id,name,px,pz,width,depth,-Math.PI/2);
    box(item,width+.06,.20,depth+.02,m.wood,0,.18,0,.035);
    box(item,width,.21,depth,m.white,0,.38,0,.07);
    box(item,width-.015,.065,depth*.72,m.bedding,0,.518,depth*.12,.032);
    box(item,width+.10,.85,.11,m.fabric,0,.61,-depth/2+.025,.055);
    for(const sx of [-width*.25,width*.25]) box(item,width*.44,.14,.43,m.white,sx,.56,-depth*.32,.06);
    box(item,width-.04,.025,.43,m.accent,0,.563,depth*.22,.012);
    return item;
  }
  bed('master-bed','主卧床',x(978),z(776),1.65,2.10);
  for(const yy of [692,855]) {
    const side=piece('master-side-'+yy,'床头柜',x(1030),z(yy),.47,.45);
    box(side,.47,.44,.45,m.wood,0,.26,0,.015);lamp(side,0,.49,0,.65);
  }
  const wardrobe=piece('master-wardrobe','主卧衣柜',x(1043),z(630),1.22,.48,-Math.PI/2);
  box(wardrobe,1.22,2.43,.48,m.cabinet,0,1.25,0,.005);
  for(const dx of [-.31,.31]) box(wardrobe,.015,.30,.015,m.metal,dx,1.1,.247,.003);
  bed('south-bed','次卧1床',x(767),z(791),1.22,1.90);
  bed('north-bed','次卧2床',x(877),z(470),1.25,1.90);
  const southWardrobe=piece('south-wardrobe','次卧1衣柜',x(786),z(690),1.15,.43);
  box(southWardrobe,1.15,2.30,.43,m.cabinet,0,1.18,0,.006);
  const northWardrobe=piece('north-wardrobe','次卧2衣柜',x(932),z(550),.66,.42,-Math.PI/2);
  box(northWardrobe,.66,2.26,.42,m.cabinet,0,1.16,0,.006);

  // 厨房柜体按可用范围布置，玄关侧门洞保持通行；冰箱位于外凸凹位。
  const kitchenLeft=x(526)+.06,kitchenRight=x(695)-.10,kitchenNorth=z(276)+.06,kitchenSouth=z(431)-.06;
  const eastLength=kitchenSouth-kitchenNorth,eastCenter=(kitchenNorth+kitchenSouth)/2;
  const counter=new THREE.Group();counter.position.set(kitchenRight-.30,0,eastCenter);counter.rotation.y=-Math.PI/2;architecture.add(counter);
  box(counter,eastLength,.77,.60,m.cabinet,0,.43,0,.008);
  box(counter,eastLength,.045,.60,m.stone,0,.84,0,.006);
  for(const dx of [-eastLength/3,0,eastLength/3]){
    box(counter,.012,.65,.008,m.dark,dx,.44,.305,0);
    box(counter,.18,.012,.018,m.metal,dx+.12,.72,.322,.003);
  }
  const sinkX=z(306)-eastCenter,hobX=z(388)-eastCenter;
  box(counter,.48,.018,.40,m.dark,sinkX,.872,0,.025);
  cylinder(counter,.012,.25,m.metal,sinkX,1.01,-.19,12);
  cylinder(counter,.012,.14,m.metal,sinkX,1.13,-.12,12).rotation.x=Math.PI/2;
  box(counter,.58,.014,.44,m.dark,hobX,.873,0,.008);
  for(const dx of [-.15,.15])for(const dz of [-.12,.12])cylinder(counter,.055,.008,m.metal,hobX+dx,.886,dz,20);
  box(counter,.66,.30,.37,m.dark,hobX,1.86,-.13,.008);
  box(counter,.25,.68,.19,m.dark,hobX,2.33,-.21,.005);
  const northWidth=kitchenRight-.60-kitchenLeft,northCenter=kitchenLeft+northWidth/2;
  const northCounter=new THREE.Group();northCounter.position.set(northCenter,0,kitchenNorth+.30);architecture.add(northCounter);
  box(northCounter,northWidth,.77,.60,m.cabinet,0,.43,0,.008);
  box(northCounter,northWidth,.045,.60,m.stone,0,.84,0,.006);
  for(const dx of [-northWidth/4,northWidth/4]){
    box(northCounter,northWidth/2-.035,.65,.018,m.cabinet,dx,.44,.309,.004);
    box(northCounter,.20,.012,.025,m.metal,dx,.72,.332,.003);
    box(northCounter,northWidth/2-.035,.70,.32,m.cabinet,dx,1.90,-.14,.006);
    box(northCounter,.014,.18,.025,m.metal,dx,1.83,.034,.003);
  }
  box(northCounter,northWidth-.04,.014,.012,m.light,0,1.53,.028,.002);
  counter.name='Kitchen_East_Wash_Prep_Cook';northCounter.name='Kitchen_North_Storage_And_Worktop';
  // 对开门面与外凸凹位旁的室内墙面齐平，拉手采用内凹形式。
  const fridgeFront=x(430)+.10,fridgeDepth=.84,fridgeWidth=1.00;
  const fridge=piece('fridge','冰箱',fridgeFront-fridgeDepth/2,z(461),fridgeWidth,fridgeDepth,Math.PI/2);
  fridge.userData.previousDefault=[x(374)+.1+.61/2+.025,0,z(461)];
  fridge.userData.fittedDefault=fridge.position.toArray();fridge.userData.doorStyle='side-by-side';
  box(fridge,fridgeWidth,2.14,.80,m.cabinet,0,1.09,-.02,.008);
  for(const side of [-1,1]){
    box(fridge,.466,2.10,.04,m.cabinet,side*.257,1.09,.40,.005);
    box(fridge,.011,.68,.006,m.dark,side*.017,1.12,.409,.001);
  }
  box(fridge,.048,2.10,.025,m.cabinet,0,1.09,.3875,.002);
  box(fridge,.006,2.08,.003,m.dark,0,1.09,.399,.001);
  box(fridge,.95,.025,.008,m.dark,0,.038,.416,.001);
  const surround=new THREE.Group();surround.position.copy(fridge.position);surround.rotation.y=Math.PI/2;architecture.add(surround);
  const nicheWidth=z(506)-z(416)-.20;
  for(const side of [-1,1])box(surround,.038,2.90,fridgeDepth,m.paint,side*(nicheWidth/2-.019),1.45,0,0);
  box(surround,nicheWidth,.74,fridgeDepth,m.paint,0,2.53,0,0);

  function bathroom(id,east=false) {
    const set=new THREE.Group();set.name=east?'卫2_侧墙洗漱与北侧淋浴':'卫1_L形洗漱与北侧淋浴';architecture.add(set);
    const left=east?x(951)+.06:x(655)+.06,right=east?x(1065)-.10:x(773)-.06;
    const north=z(386)+.10,south=z(581)-.06,northLeft=east?left:x(695)+.10;
    const leftStart=east?north:z(431)+.06;
    box(set,.009,2.88,south-leftStart,m.wetWall,left+.006,1.44,(leftStart+south)/2,0);
    box(set,.009,2.88,south-north,m.wetWall,right-.006,1.44,(north+south)/2,0);
    if(!east)box(set,northLeft-left,2.88,.009,m.wetWall,(left+northLeft)/2,1.44,leftStart+.006,0);
    // 北墙饰面按窗洞拆分，保留窗台、窗玻璃与采光开口。
    const window=model.openings.find(h=>h.kind==='window'&&h.axis==='h'&&Math.abs(h.fixed-z(386))<.001&&h.start>northLeft&&h.end<right);
    if(window){
      box(set,right-northLeft,window.sill,.009,m.wetWall,(northLeft+right)/2,window.sill/2,north+.006,0);
      box(set,right-northLeft,2.88-window.top,.009,m.wetWall,(northLeft+right)/2,(2.88+window.top)/2,north+.006,0);
      box(set,window.start-northLeft,2.88,.009,m.wetWall,(northLeft+window.start)/2,1.44,north+.006,0);
      box(set,right-window.end,2.88,.009,m.wetWall,(right+window.end)/2,1.44,north+.006,0);
    }
    function footprint(kind,px,pz,w,d){
      const data={id:id+'-'+kind,roomId:id,kind,minX:px-w/2,maxX:px+w/2,minZ:pz-d/2,maxZ:pz+d/2};
      bathFootprints.push(data);return data;
    }
    // 洗手台贴近门口的侧墙，镜子同向；留空南侧门洞及门扇扫掠范围。
    const vanityX=east?right-.23:left+.23,vanityZ=6.22;
    const vanity=new THREE.Group();vanity.position.set(vanityX,0,vanityZ);vanity.rotation.y=east?-Math.PI/2:Math.PI/2;set.add(vanity);
    box(vanity,.72,.46,.44,m.wood,0,.59,0,.012);
    box(vanity,.70,.22,.016,m.cabinet,0,.70,.229,.005);
    box(vanity,.70,.19,.016,m.cabinet,0,.47,.229,.005);
    box(vanity,.26,.010,.02,m.metal,0,.73,.244,.002);
    box(vanity,.26,.010,.02,m.metal,0,.50,.244,.002);
    // 台面四边围出盆口，避免实心台面把洗手盆填平。
    for(const side of [-1,1]){
      box(vanity,.12,.04,.45,m.stone,side*.30,.84,0,.004);
      box(vanity,.48,.04,.055,m.stone,0,.84,side*.1975,.004);
    }
    const bowlMat=m.white.clone();bowlMat.side=THREE.DoubleSide;
    const bowl=mesh(new THREE.SphereGeometry(1,28,16,0,Math.PI*2,Math.PI/2,Math.PI/2),bowlMat,vanity,[0,.928,0]);bowl.scale.set(.225,.08,.154);
    const rimGeometry=new THREE.TorusGeometry(.225,.012,8,36);rimGeometry.rotateX(-Math.PI/2);rimGeometry.scale(1,1,.69);
    mesh(rimGeometry,m.white,vanity,[0,.929,0]);
    cylinder(vanity,.012,.18,m.metal,0,.955,-.17,12);
    const tap=cylinder(vanity,.012,.13,m.metal,0,1.045,-.108,12);tap.rotation.x=Math.PI/2;
    box(vanity,.65,.84,.025,m.metal,0,1.56,-.214,.008);
    box(vanity,.61,.80,.008,m.mirror,0,1.56,-.196,.005);
    const mirror=new Reflector(new THREE.PlaneGeometry(.605,.795),{textureWidth:512,textureHeight:512,color:0xe7eae8,clipBias:.003});
    mirror.position.set(0,1.56,-.190);vanity.add(mirror);mirrors.push(mirror);
    const reflect=mirror.onBeforeRender.bind(mirror);let lastReflection=-Infinity;
    mirror.onBeforeRender=(...args)=>{const now=performance.now();if(now-lastReflection<100)return;lastReflection=now;reflect(...args);};
    box(vanity,.61,.025,.022,m.light,0,2.015,-.192,.003);
    footprint('vanity',vanityX,vanityZ,.46,.72);
    const toiletX=east?right-.345:left+.345,toiletZ=5.46;
    const toilet=new THREE.Group();toilet.position.set(toiletX,0,toiletZ);toilet.rotation.y=east?-Math.PI/2:Math.PI/2;set.add(toilet);
    box(toilet,.35,.40,.15,m.white,0,.49,-.24,.035);
    box(toilet,.12,.008,.045,m.metal,0,.694,-.24,.003);
    sphere(toilet,.18,.13,.29,m.white,0,.33,.015);
    const seat=mesh(new THREE.TorusGeometry(.13,.017,10,32),m.white,toilet,[0,.48,.025]);seat.rotation.x=-Math.PI/2;seat.scale.y=1.45;
    sphere(toilet,.116,.012,.16,m.dark,0,.481,.025);
    cylinder(toilet,.10,.26,m.white,0,.17,0,20);
    footprint('toilet',toiletX,toiletZ,.67,.38);
    const showerEnd=north+.96,wetWidth=right-northLeft;
    box(set,wetWidth-.025,.026,.94,m.tile,(northLeft+right)/2,.023,north+.48,.005);
    const screenWidth=east?.72:.32,screenX=east?right-screenWidth/2:northLeft+screenWidth/2;
    const pane=box(set,screenWidth,2.02,.010,m.glass,screenX,1.04,showerEnd,0);pane.castShadow=false;
    cylinder(set,.008,2.03,m.metal,east?right-screenWidth:northLeft+screenWidth,1.045,showerEnd,12);
    footprint('shower-screen',screenX,showerEnd,screenWidth,.018);
    // 固定玻璃只占一部分宽度，另一侧作为步入通道，不再封死淋浴区。
    const showerEntryX=east?(northLeft+right-screenWidth)/2:(northLeft+screenWidth+right)/2;
    const shower=new THREE.Group();shower.position.set(right-.022,0,north+.38);shower.rotation.y=-Math.PI/2;set.add(shower);
    cylinder(shower,.009,1.12,m.metal,0,1.68,.018,12);
    for(const py of [1.18,2.15])box(shower,.045,.025,.05,m.metal,0,py,.003,.004);
    box(shower,.27,.045,.065,m.metal,0,1.01,.042,.008);
    const arm=cylinder(shower,.011,.30,m.metal,0,2.23,.15,12);arm.rotation.x=Math.PI/2;
    cylinder(shower,.092,.014,m.metal,0,2.23,.30,28);
    const handset=cylinder(shower,.023,.14,m.metal,.08,1.53,.062,16);handset.rotation.x=.35;
    box(set,.095,.004,.095,m.metal,right-.16,.039,north+.17,.003);
    set.userData={bathroom:id,shower:{width:wetWidth,depth:.96,entryWidth:wetWidth-screenWidth},
      accessPoints:[[east?vanityX-.52:vanityX+.52,vanityZ],[east?toiletX-.57:toiletX+.57,toiletZ],
        [showerEntryX,north+.46]],windowUnblocked:!!window};
  }
  bathroom('bath-west');bathroom('bath-east',true);

  const balconyChair=piece('balcony-chair','阳台休闲椅',.88,z(933),.72,.74,-.24);
  box(balconyChair,.65,.20,.66,m.fabric,0,.40,0,.08);
  box(balconyChair,.66,.52,.13,m.fabric,0,.71,-.25,.06);
  const sideTable=piece('balcony-table','阳台边几',1.69,z(950),.51,.51,0,true);
  box(sideTable,.51,.045,.51,m.wood,0,.50,0,.007);box(sideTable,.09,.46,.09,m.metal,0,.25,0,.004);
  plant('balcony-plant',2.65,z(955),1.75);
  const washer=new THREE.Group();architecture.add(washer);
  box(washer,.60,.86,.61,m.white,x(811),.45,z(948),.02);
  const window=mesh(new THREE.TorusGeometry(.20,.035,12,48),m.dark,washer,[x(811),.48,z(948)-.31]);
  sphere(washer,.17,.17,.013,m.glass,x(811),.48,z(948)-.32);

  // 固定灯具与动态光源分开管理，夜景不会仅仅给画面套滤镜。
  [[.9,z(257)],[(kitchenLeft+kitchenRight)/2,eastCenter],[1.2,z(538)],[1.8,z(728)],[x(957),z(725)],[x(755),z(731)],
    [x(850),z(483)],[x(621),z(193)],[x(687),z(500)],[x(1009),z(493)]].forEach(([px,pz])=>{
    cylinder(architecture,.055,.025,m.metal,px,2.881,pz,24);
    const light=new THREE.PointLight(0xffdfb1,0,5,2);light.position.set(px,2.54,pz);scene.add(light);roomLights.push(light);
    sphere(architecture,.032,.007,.032,m.light,px,2.862,pz);
  });

  const startTransforms=new Map(pieces.map(item=>[item.userData.id,{position:item.position.toArray(),rotation:item.rotation.y}]));
  // 静态饰面按材质合批，保留门扇和家具为独立对象，降低室内漫游的绘制开销。
  architecture.updateMatrixWorld(true);
  const batches=new Map();
  architecture.traverse(item=>{
    if(!item.isMesh||item.isReflector) return;
    let parent=item.parent;
    while(parent&&parent!==architecture){if(doors.some(door=>door.hinge===parent)) return;parent=parent.parent;}
    const key=item.material.uuid+':'+item.castShadow;
    if(!batches.has(key)) batches.set(key,{material:item.material,shadow:item.castShadow,meshes:[]});
    batches.get(key).meshes.push(item);
  });
  for(const batch of batches.values()) {
    const geometries=batch.meshes.map(item=>{
      const geometry=item.geometry.index?item.geometry.toNonIndexed():item.geometry.clone();
      geometry.applyMatrix4(item.matrixWorld);return geometry;
    });
    const geometry=mergeGeometries(geometries,false);
    if(!geometry) continue;
    batch.meshes.forEach(item=>item.removeFromParent());
    const combined=mesh(geometry,batch.material,architecture);combined.castShadow=batch.shadow;
    geometries.forEach(item=>item.dispose());
  }
  const fixedFootprints=[
    [kitchenRight-.30,eastCenter,.60,eastLength],[northCenter,kitchenNorth+.30,northWidth,.60],
    [x(811),z(948),.60,.61]
  ].map(([px,pz,w,d])=>({minX:px-w/2,maxX:px+w/2,minZ:pz-d/2,maxZ:pz+d/2})).concat(bathFootprints);
  function setTheme(id) {
    const theme=themes[id]||themes.warm;currentTheme=id in themes?id:'warm';
    for(const role of ['paint','wood','fabric','bedding','accent','cabinet','metal','stone']) m[role].color.set(theme[role]);
    m.floor.color.set(theme.floor);m.floor.map=theme.floorType==='stone'?stoneMap:floorMap;
    m.floor.normalMap=theme.floorType==='stone'?stoneNormal:floorNormal;m.floor.needsUpdate=true;
    m.tile.color.set(theme.stone);
    m.wetWall.color.set(theme.paint);
    m.seam.color.copy(m.fabric.color).multiplyScalar(.8);
    const floorMaterial=bakedMaterials.get(model.slab);
    if(floorMaterial){floorMaterial.map=m.floor.map;floorMaterial.normalMap=m.floor.normalMap;floorMaterial.needsUpdate=true;}
  }
  function setRaw(value) {
    raw=value;group.visible=!value;
    model.solids.forEach(item=>{item.material=value?rawWalls.get(item):(bakedMaterials.get(item)||m.paint);item.children.forEach(child=>{if(child.isLineSegments)child.visible=value;});});
    const floorMaterial=bakedMaterials.get(model.slab);
    if(floorMaterial){floorMaterial.map=m.floor.map;floorMaterial.normalMap=m.floor.normalMap;floorMaterial.needsUpdate=true;}
    model.slab.material=value?rawFloor:(floorMaterial||m.floor);ceiling.material=value?rawCeiling:(bakedMaterials.get(ceiling)||m.paint);
  }
  function colliders(includeHiddenScene=false) {
    if(raw&&!includeHiddenScene) return [];
    return fixedFootprints.concat(pieces.filter(item=>item.visible&&item.userData.collidable).map(item=>{
      const {width,depth}=item.userData,a=item.rotation.y;
      const w=Math.abs(Math.cos(a))*width+Math.abs(Math.sin(a))*depth;
      const d=Math.abs(Math.sin(a))*width+Math.abs(Math.cos(a))*depth;
      return {minX:item.position.x-w/2,maxX:item.position.x+w/2,minZ:item.position.z-d/2,maxZ:item.position.z+d/2,id:item.userData.id};
    }));
  }
  function update(delta,position,isWalk,night) {
    let shadowChanged=false;
    for(const door of doors) {
      const {hole,hinge}=door,center=(hole.start+hole.end)/2;
      const px=hole.axis==='h'?center:hole.fixed,pz=hole.axis==='h'?hole.fixed:center;
      if(door.type==='slide'){
        const target=isWalk&&Math.hypot(position.x-px,position.z-pz)<1.6?door.distance:0;
        const offset=THREE.MathUtils.damp(door.offset,target,7,delta);
        if(Math.abs(offset-door.offset)>.002)shadowChanged=true;
        door.offset=offset;hinge.position.x=offset;continue;
      }
      const target=isWalk&&Math.hypot(position.x-px,position.z-pz)<1.6?door.swing*Math.PI/2:0;
      const angle=THREE.MathUtils.damp(door.angle,target,7,delta);
      if(Math.abs(angle-door.angle)>.002)shadowChanged=true;
      door.angle=angle;hinge.rotation.y=door.angle;
    }
    roomLights.forEach(light=>{light.intensity=night?4.8:.35;});
    m.light.emissiveIntensity=night?2.5:.40;
    bakedMaterials.forEach(material=>{material.lightMapIntensity=!night&&currentTheme==='warm'?Math.PI*1.5:0;});
    mirrors.forEach(mirror=>{const point=mirror.getWorldPosition(new THREE.Vector3());mirror.visible=isWalk&&!raw&&Math.hypot(position.x-point.x,position.z-point.z)<2.5;});
    return shadowChanged;
  }
  const loader=new GLTFLoader();
  function fitImported(source,w,h,d) {
    const clone=source.clone(true);clone.updateMatrixWorld(true);
    const bounds=new THREE.Box3().setFromObject(clone),size=bounds.getSize(new THREE.Vector3());
    const scaled=new THREE.Group();clone.position.set(-bounds.getCenter(new THREE.Vector3()).x,-bounds.min.y,-bounds.getCenter(new THREE.Vector3()).z);
    scaled.add(clone);scaled.scale.set(w/size.x,h/size.y,d/size.z);
    clone.traverse(item=>{if(item.isMesh){item.castShadow=true;item.receiveShadow=true;item.material=item.material.clone();}});return scaled;
  }
  const ready=Promise.all([loader.parseAsync(JSON.stringify(chairData),''),loader.parseAsync(JSON.stringify(armchairData),''),loader.parseAsync(JSON.stringify(plantData),''),
    loader.parseAsync(decodeBinary(sofaData.glb),''),loader.parseAsync(JSON.stringify(coffeeData),'')]).then(([chair,armchair,plant,tailoredSofa,scannedCoffee])=>{
    pieces.filter(item=>item.userData.id.startsWith('dining-chair')).forEach(item=>{
      item.clear();item.add(fitImported(chair.scene,.46,.84,.49));
    });
    balconyChair.clear();balconyChair.add(fitImported(armchair.scene,.72,.90,.74));
    pieces.filter(item=>item.userData.id.endsWith('-plant')).forEach(item=>{
      item.clear();item.add(fitImported(plant.scene,.64,item.userData.id==='balcony-plant'?1.65:1.45,.62));
    });
    sofa.clear();const detailed=fitImported(tailoredSofa.scene,2.25,1.04,.84);
    detailed.traverse(item=>{if(!item.isMesh)return;const name=item.material.name;
      item.material=name.includes('Accent')?m.accentFabric:name.includes('Bedding')?m.bedding:name.includes('Oak')?m.wood:
        name.includes('DarkMetal')?m.dark:name.includes('Seam')?m.seam:m.fabric;
      if(name.includes('Bedding'))item.material.side=THREE.DoubleSide;
    });sofa.add(detailed);
    coffee.clear();coffee.add(fitImported(scannedCoffee.scene,1.10,.41,.66));
    box(coffee,.29,.025,.20,m.accent,-.15,.424,.02,.004);
    cylinder(coffee,.048,.060,m.white,.23,.44,-.04,24);
  });
  setTheme('warm');setRaw(false);
  return {group,architecture,furnishings,pieces,materials:m,doors,mirrors,ready,roomViews,setTheme,setRaw,colliders,update,
    installBake(data,lightMap){
      for(const item of [...model.solids,model.slab,ceiling]){
        const entry=data[item===ceiling?'Ceiling_Interior':item.name];if(!entry)throw new Error('Missing baked geometry: '+item.name);
        const geometry=new THREE.BufferGeometry();
        for(const [name,size] of [['position',3],['normal',3],['uv',2],['uv1',2]])geometry.setAttribute(name,new THREE.Float32BufferAttribute(entry[name],size));
        if(item===model.slab){const uv=geometry.attributes.uv;for(let i=0;i<uv.count;i++)uv.setY(i,1-uv.getY(i));}
        geometry.computeBoundingBox();item.geometry=geometry;
        const source=item===model.slab?m.floor:m.paint,material=source.clone();material.color=source.color;
        material.lightMap=lightMap;material.lightMapIntensity=Math.PI*1.5;material.envMapIntensity=.12;bakedMaterials.set(item,material);
      }
      setRaw(raw);
    },
    get raw(){return raw;},get theme(){return currentTheme;},
    reset(){pieces.forEach(item=>{const start=startTransforms.get(item.userData.id);item.position.fromArray(start.position);item.rotation.y=start.rotation;item.visible=true;});},
    setFloor(kind){m.floor.map=kind==='stone'?stoneMap:floorMap;m.floor.normalMap=kind==='stone'?stoneNormal:floorNormal;
      m.floor.color.set(kind==='dark-wood'?'#a58a70':'#ffffff');m.floor.needsUpdate=true;
      const material=bakedMaterials.get(model.slab);
      if(material){material.map=m.floor.map;material.normalMap=m.floor.normalMap;material.needsUpdate=true;}}
  };
}
