"""复用全景人体生成器，按实时家具支撑面导出原创米制假人资产。"""
import bpy,json,math,base64,sys
from pathlib import Path
from mathutils import Vector

ROOT=Path(__file__).resolve().parent
sys.path.insert(0,str(ROOT))
from mannequins import pose,RATIOS
from panorama_detail import material,mesh_object

target=ROOT/'realism-assets/mannequins.json'
capture=ROOT/'live-people-capture.json'
placements=json.loads(capture.read_text(encoding='utf-8-sig'))['data']['result'] if capture.exists() else json.loads(target.read_text())['placements']
assert len(placements)==14
bpy.ops.wm.read_factory_settings(use_empty=True)
material('Mannequin_170','78999f',.65);material('Mannequin_160','c4b393',.65)
for row in placements:
    floor=max(0,row.get('floor',0))
    person,hip=pose(row['id'],row['height'],row['pose'],row.get('seat',0),floor)
    if row['pose']=='lying':
        hip=row['surface']+.061*row['height'];person.rotation_euler.x=-math.pi/2
    x,z=row.get('offset',row.get('position',[0,0]))
    person.location=(x,-z,hip);person.rotation_euler.z=row.get('rotation',0)
    person['anchor_id']=row.get('anchor','');person['room']=row['room']
    # 每个人合并为一个网格，避免数百个肢体部件增加浏览器绘制开销。
    bpy.context.view_layer.update();deps=bpy.context.evaluated_depsgraph_get()
    vertices=[];faces=[];inverse=person.matrix_world.inverted();parts=list(person.children_recursive)
    for part in parts:
        if part.type!='MESH':continue
        evaluated=part.evaluated_get(deps);mesh=evaluated.to_mesh();offset=len(vertices)
        transform=inverse@part.matrix_world
        vertices.extend(tuple(transform@v.co) for v in mesh.vertices)
        faces.extend(tuple(offset+i for i in p.vertices) for p in mesh.polygons)
        evaluated.to_mesh_clear()
    for part in reversed(parts):bpy.data.objects.remove(part,do_unlink=True)
    mesh_object('Body_'+row['id'],vertices,faces,bpy.data.materials['Mannequin_170' if row['height']==1.7 else 'Mannequin_160'],person)
    axis=person.matrix_world.to_3x3()@Vector((0,0,1))
    points=[person.matrix_world@Vector(v) for v in vertices]
    if row['pose']!='seated':
        extent=max(p.dot(axis) for p in points)-min(p.dot(axis) for p in points)
        assert abs(extent-row['height'])<1e-5,'站高与卧长必须保持输入值'
bpy.ops.object.select_all(action='SELECT')
glb=ROOT/'live-mannequins.glb'
bpy.ops.export_scene.gltf(filepath=str(glb),export_format='GLB',use_selection=True,export_extras=True,export_apply=True,export_yup=True,export_animations=False)
target.write_text(json.dumps({'glb':base64.b64encode(glb.read_bytes()).decode(),'placements':placements,'ratios':RATIOS},ensure_ascii=False,separators=(',',':')),encoding='utf-8')
print('LIVE_MANNEQUINS_EXPORTED',len(placements),'GLB_BYTES',glb.stat().st_size,flush=True)
