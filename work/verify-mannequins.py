"""核对实际人体网格身高、骨长、人数、脚底和场景穿插。"""
import bpy,json,math
from collections import Counter
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree

root=Path(__file__).resolve().parent
bpy.ops.wm.open_mainfile(filepath=str(root/'panorama-render/v3/people-base.blend'))
scene=bpy.context.scene;deps=bpy.context.evaluated_depsgraph_get()
people=[o for o in scene.objects if 'mannequin_id' in o]
assert len(people)==14
assert Counter(o['room'] for o in people)=={'dining':4,'living':2,'master':2,'bedroom-south':1,'bedroom-north':1,'bath-west':1,'bath-east':1,'kitchen':2}
assert Counter(round(o['height_m'],1) for o in people)=={1.7:7,1.6:7}
for person in people:
    # 世界坐标检查，沙发等非均匀变换不得使人体骨长改变。
    linear=person.matrix_world.to_3x3()
    assert all(abs((linear@Vector(v)).length-1)<.00001 for v in [(1,0,0),(0,1,0),(0,0,1)])
    joints=json.loads(person['joint_positions']);h=person['height_m']
    for limb in joints.values():
        for a,b,ratio in [('hip','knee',.244),('knee','ankle',.242),('shoulder','elbow',.186),('elbow','wrist',.146)]:
            pa,pb=person.matrix_world@Vector(limb[a]),person.matrix_world@Vector(limb[b])
            assert abs((pa-pb).length-h*ratio)<.00001,(person.name,a,b)
    points=[o.matrix_world@v.co for o in person.children_recursive if o.type=='MESH' for v in o.data.vertices]
    if person['pose']!='seated':
        axis=linear@Vector((0,0,1));projection=[p.dot(axis) for p in points]
        assert abs(max(projection)-min(projection)-h)<.00001,'站姿身高与卧姿纵向长度都应保持输入身高'
    assert min(p.z for p in points)>-.00001,'脚底不能穿地'

# 用世界坐标BVH比较人体与家具表面；支撑接触单独检查，不忽略墙柜穿插。
meshes=[o for o in scene.objects if o.type=='MESH' and not o.hide_render and not o.name.startswith('Mannequin_') and not any(s.material and s.material.name=='装修_wetWall' for s in o.material_slots)]
trees={};boxes={};face_centers={}
def geometry(obj):
    if obj not in trees:
        evaluated=obj.evaluated_get(deps);mesh=evaluated.to_mesh()
        vertices=[evaluated.matrix_world@v.co for v in mesh.vertices]
        trees[obj]=BVHTree.FromPolygons(vertices,[list(p.vertices) for p in mesh.polygons],all_triangles=False)
        face_centers[obj]=[sum((vertices[i] for i in p.vertices),Vector())/len(p.vertices) for p in mesh.polygons]
        boxes[obj]=[[min(v[i] for v in vertices) for i in range(3)],[max(v[i] for v in vertices) for i in range(3)]]
        evaluated.to_mesh_clear()
    return trees[obj]
def bbox(obj):
    if obj in boxes:return boxes[obj]
    p=[obj.matrix_world@Vector(v) for v in obj.bound_box]
    return [[min(v[i] for v in p) for i in range(3)],[max(v[i] for v in p) for i in range(3)]]
def overlap(a,b):return all(a[0][i]<b[1][i]-.0005 and b[0][i]<a[1][i]-.0005 for i in range(3))
collisions=[]
for person in people:
    for part in person.children_recursive:
        if part.type!='MESH':continue
        for furniture in meshes:
            if not overlap(bbox(part),bbox(furniture)):continue
            intersections=geometry(part).overlap(geometry(furniture))
            if not intersections:continue
            # 枕头和被面允许人体接触/轻微压陷，马桶座圈也为预期支撑。
            if furniture.name.startswith(('Detail_Pillow','Detail_Duvet','Draped_Bed_Runner','Seat_Outer')):continue
            if 'support_meshes' in person and furniture.name in json.loads(person['support_meshes']) and part.name.startswith(('Mannequin_Pelvis','Mannequin_Thigh')):
                contact=[face_centers[furniture][b].z for a,b in intersections]
                if all(abs(z-person['support_z'])<.030 for z in contact):continue
            collisions.append([person['mannequin_id'],part.name,furniture.name])
for p in json.loads((root/'panorama-points.json').read_text(encoding='utf-8')):
    origin=Vector((p['position'][0],-p['position'][2],p['position'][1]))
    for direction in [Vector((1,0,0)),Vector((-1,0,0)),Vector((0,1,0)),Vector((0,-1,0))]:
        ok,*_=scene.ray_cast(deps,origin,direction,distance=.15);assert not ok,'相机被假人或家具挡住：'+p['id']
(root/'mannequin-collision-check.json').write_text(json.dumps(collisions,ensure_ascii=False,indent=2),encoding='utf-8')
print('MANNEQUIN_VALIDATION',{'people':len(people),'heights':[1.7,1.6],'boneScale':'verified','collisions':collisions},flush=True)
assert not collisions,'先修复人体与家具的非支撑穿插，再渲染'
