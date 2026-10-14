// 从已载入的实体网格采样支撑面，导出实时工作台的米制假人摆放数据。
(async()=>{
  const {interior,scene,camera}=shellViewer;await interior.ready;scene.updateMatrixWorld(true);
  const vector=()=>camera.position.clone();
  function support(objects,x,z,start,distance){
    let height=-Infinity;
    for(const root of objects)root.traverse(mesh=>{
      if(!mesh.isMesh||!mesh.geometry.attributes.position||mesh.parent?.userData.mannequin_id)return;
      const positions=mesh.geometry.attributes.position,index=mesh.geometry.index;
      const count=index?index.count:positions.count;
      for(let i=0;i<count;i+=3){
        const p=[0,1,2].map(j=>vector().fromBufferAttribute(positions,index?index.getX(i+j):i+j).applyMatrix4(mesh.matrixWorld));
        const [a,b,c]=p,den=(b.z-c.z)*(a.x-c.x)+(c.x-b.x)*(a.z-c.z);
        if(Math.abs(den)<1e-10)continue;
        const u=((b.z-c.z)*(x-c.x)+(c.x-b.x)*(z-c.z))/den;
        const v=((c.z-a.z)*(x-c.x)+(a.x-c.x)*(z-c.z))/den,w=1-u-v;
        if(Math.min(u,v,w)<-1e-7)continue;
        const y=u*a.y+v*b.y+w*c.y;
        if(y<=start+1e-7&&y>=start-distance)height=Math.max(height,y);
      }
    });
    if(!Number.isFinite(height))throw Error('找不到实体支撑面');return height;
  }
  const rows=[],piece=id=>interior.pieces.find(p=>p.userData.id===id);
  function seated(id,h,room,anchor,x,z,seat){
    const target=piece(anchor),p=target.localToWorld(vector().set(x,0,z));
    const foot=target.localToWorld(vector().set(x,0,z+.35));
    rows.push({id,height:h,room,pose:'seated',anchor,offset:[x,z],seat:seat??support([target],p.x,p.z,.65,.65),floor:support([scene],foot.x,foot.z,.10,.20)});
  }
  interior.pieces.filter(p=>p.userData.id.startsWith('dining-chair')).sort((a,b)=>a.userData.id.localeCompare(b.userData.id)).forEach((p,i)=>seated('dining-'+(i+1),i%2?1.6:1.7,'dining',p.userData.id,0,.055));
  [1.7,1.6].forEach((h,i)=>seated('sofa-'+(i+1),h,'living','sofa',(i*2-1)*.48,.19));
  for(const [anchor,room,depth,heights] of [['master-bed','master',2.1,[1.7,1.6]],['south-bed','bedroom-south',1.9,[1.7]],['north-bed','bedroom-north',1.9,[1.6]]]){
    heights.forEach((h,i)=>{const x=heights.length===2?(i*2-1)*.385:0,z=-depth/2+.15+.470*h;
      const target=piece(anchor),p=target.localToWorld(vector().set(x,0,z));
      rows.push({id:room+'-'+(i+1),height:h,room,pose:'lying',anchor,offset:[x,z],surface:support([target],p.x,p.z,.80,.50)});
    });
  }
  // 原工作台的座圈顶面为0.497米；湿区地面顶面为0.008米。
  [1.7,1.6].forEach((h,i)=>rows.push({id:'toilet-'+(i+1),height:h,room:i?'bath-east':'bath-west',pose:'seated',anchor:i?'bath-east-toilet':'bath-west-toilet',offset:[0,.055],seat:.497,floor:.008}));
  [[1.7,2.8,3.58],[1.6,3,4.23]].forEach(([h,x,z],i)=>rows.push({id:'kitchen-'+(i+1),height:h,room:'kitchen',pose:'standing',position:[x,z],floor:support([scene],x,z,.10,.20),rotation:Math.PI/2}));
  return rows;
})()
