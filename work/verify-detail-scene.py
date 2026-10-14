"""验证新场景的实体变化、盆腔和相机净空，不把技术检查当成视觉验收。"""
import bpy
import json
from pathlib import Path
from mathutils import Vector
root=Path(__file__).resolve().parent
bpy.ops.wm.open_mainfile(filepath=str(root/'panorama-render/v2/detailed-base.blend'))
scene=bpy.context.scene;deps=bpy.context.evaluated_depsgraph_get()
beds=[o for o in scene.objects if o.name.startswith('Detail_Bed')]
assert len(beds)==3
duvets=[o for o in scene.objects if o.type=='MESH' and o.name.startswith('Detail_Duvet')]
assert len(duvets)==3
for obj in duvets:
    bottom=min(v.co.z for v in obj.data.vertices);top=max(v.co.z for v in obj.data.vertices)
    assert .10<bottom<.50 and .50<top<.70,'被面必须已下垂，不能穿过地面'
layout=json.loads((root/'panorama-detail-layout.json').read_text(encoding='utf-8'))
x,z=layout['kitchen']['x'],layout['kitchen']['sinkZ']
ok,point,normal,index,obj,matrix=scene.ray_cast(deps,Vector((x-.035,-z+.03,1.0)),Vector((0,0,-1)),distance=.6)
assert ok and point.z<.75,'水槽盆腔不能被台面或柜体填平'
assert len([o for o in scene.objects if o.name.startswith('Detail_Toilet')])==2
assert len([o for o in scene.objects if o.name.startswith('Ceramic_Glass_Cooktop')])==1
points=json.loads((root/'panorama-points.json').read_text(encoding='utf-8'))
for p in points:
    origin=Vector((p['position'][0],-p['position'][2],p['position'][1]))
    for direction in [Vector((1,0,0)),Vector((-1,0,0)),Vector((0,1,0)),Vector((0,-1,0))]:
        ok,hit,*_=scene.ray_cast(deps,origin,direction,distance=.15)
        assert not ok,'相机不能在墙体或家具中：'+p['name']
print('DETAIL_SCENE_VALID',{'beds':3,'toilets':2,'sinkDepth':round(.878-point.z,3),'cameraClearance':11},flush=True)
