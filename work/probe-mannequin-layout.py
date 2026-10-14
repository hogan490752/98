"""读取家具真实变换及座面高度，假人定位以场景米制坐标为准。"""
import bpy,json
from pathlib import Path
from mathutils import Vector
root=Path(__file__).resolve().parent
bpy.ops.wm.open_mainfile(filepath=str(root/'panorama-render/v2/detailed-base.blend'))
deps=bpy.context.evaluated_depsgraph_get()
for obj in bpy.context.scene.objects:
    id=str(obj.get('id',''))
    if not (id.startswith('dining-chair') or obj.name.startswith(('Detail_Bed','Detail_Toilet')) or obj.name=='Preview_Sofa'):continue
    corners=[child.matrix_world@Vector(p) for child in obj.children_recursive if child.type=='MESH' for p in child.bound_box]
    print('FURNITURE',obj.name,id,'matrix',[list(row) for row in obj.matrix_world],'bounds',[[min(p[i] for p in corners) for i in range(3)],[max(p[i] for p in corners) for i in range(3)]],flush=True)
    if id.startswith('dining-chair') or obj.name=='Preview_Sofa':
        for local in [(0,0),(-.45,-.08),(.45,-.08)]:
            p=obj.matrix_world@Vector((*local,0));p.z=.65
            ok,hit,normal,index,item,matrix=bpy.context.scene.ray_cast(deps,p,Vector((0,0,-1)),distance=.65)
            print('SEAT_RAY',local,ok,list(hit),item.name if item else None,flush=True)
