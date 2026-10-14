import bpy
import math
from mathutils import Vector
from pathlib import Path
root=Path(__file__).resolve().parent
bpy.ops.wm.open_mainfile(filepath=str(root/'panorama-render/furnished-panorama.blend'))
origin=Vector((8.16,-6.57,1.55));deps=bpy.context.evaluated_depsgraph_get()
forward=(Vector((8.81,-5.64,1.15))-origin).normalized();right=forward.cross(Vector((0,0,1))).normalized();up=right.cross(forward).normalized()
for px,py in [(130,430),(450,440),(1100,430)]:
    direction=(forward+(2*px/1440-1)*math.tan(math.radians(35))*1440/936*right+(1-2*(py-64)/936)*math.tan(math.radians(35))*up).normalized()
    at=origin.copy();hits=[]
    for i in range(6):
        ok,point,normal,index,obj,matrix=bpy.context.scene.ray_cast(deps,at,direction,distance=10)
        if not ok:break
        mat=obj.material_slots[obj.data.polygons[index].material_index].material
        hits.append((obj.name,mat.name,tuple(point)));at=point+direction*.002
    print('PIXEL',px,py,hits,flush=True)
mat=bpy.data.materials.get('装修_wetWall')
for node in mat.node_tree.nodes:
    print('NODE',node.type,[(i.name,str(getattr(i,'default_value',None)),i.is_linked) for i in node.inputs],flush=True)
print('LINKS',[(l.from_node.name,l.from_socket.name,l.to_node.name,l.to_socket.name) for l in mat.node_tree.links],flush=True)
bsdf=mat.node_tree.nodes.get('Principled BSDF');print('COLOR',tuple(bsdf.inputs['Base Color'].default_value),flush=True)
for material in bpy.data.materials:
    if not material.use_nodes:continue
    for node in material.node_tree.nodes:
        if node.type=='BSDF_PRINCIPLED':
            weight=node.inputs.get('Weight')
            print('WEIGHT',material.name,weight.default_value if weight else None,weight.is_unavailable if weight else None,flush=True)
for px in [7.85,8.25,8.70,9.15]:
    direction=(Vector((px,-4.12,1.0))-origin).normalized();at=origin.copy();hits=[]
    for i in range(8):
        ok,point,normal,index,obj,matrix=bpy.context.scene.ray_cast(deps,at,direction,distance=10)
        if not ok:break
        mat=obj.material_slots[obj.data.polygons[index].material_index].material
        nodes=mat.node_tree.nodes
        polygon=obj.data.polygons[index]
        shading=(obj.matrix_world.to_3x3()@obj.data.corner_normals[polygon.loop_start].vector).normalized()
        hits.append((obj.name,mat.name,tuple(point),tuple(normal),tuple(shading),normal.dot(shading)))
        at=point+direction*.002
    print('RAY',px,hits,flush=True)
