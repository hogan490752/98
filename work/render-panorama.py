"""从已确认户型渲染完整装修场景和固定点位全景。"""
import bpy
import json
import math
import sys
from pathlib import Path
from mathutils import Vector

ROOT=Path(__file__).resolve().parent
OUT=ROOT/'panorama-render'
OUT.mkdir(exist_ok=True)
sys.path.insert(0,str(ROOT))

def descendants(obj):
    return [obj]+[child for item in obj.children for child in descendants(item)]

def bounds(objects):
    points=[obj.matrix_world@Vector(v) for obj in objects if obj.type=='MESH' for v in obj.bound_box]
    return Vector(tuple(min(p[i] for p in points) for i in range(3))),Vector(tuple(max(p[i] for p in points) for i in range(3)))

def add_area(name,position,target,energy,size,color=(1,.93,.82)):
    light=bpy.data.lights.new(name,'AREA');light.energy=energy;light.shape='DISK';light.size=size;light.color=color
    obj=bpy.data.objects.new(name,light);bpy.context.collection.objects.link(obj);obj.location=position
    obj.rotation_euler=(Vector(target)-obj.location).to_track_quat('-Z','Y').to_euler()

def setup():
    bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
    bpy.ops.import_scene.gltf(filepath=str(ROOT.parent/'outputs/暖木现代-装修模型.glb'))
    # 替换粗略软包；原家具位置和旋转保持已确认布局。
    old=next(o for o in bpy.context.scene.objects if o.get('id')=='sofa')
    sofa_matrix=old.matrix_world.copy()
    for obj in reversed(descendants(old)):bpy.data.objects.remove(obj,do_unlink=True)
    before=set(bpy.context.scene.objects)
    bpy.ops.import_scene.gltf(filepath=str(ROOT/'realism-assets/product-sofa.glb'))
    imported=[o for o in bpy.context.scene.objects if o not in before]
    bpy.context.view_layer.update();low,high=bounds(imported);center=(low+high)/2
    root=bpy.data.objects.new('Preview_Sofa',None);bpy.context.collection.objects.link(root)
    for obj in imported:
        if obj.parent in imported:continue
        matrix=obj.matrix_world.copy();obj.parent=root;obj.matrix_world=matrix
    for obj in root.children:obj.location-=Vector((center.x,center.y,low.z))
    size=high-low;root.scale=(2.25/size.x,.84/size.y,1)
    root.location=sofa_matrix.translation;root.rotation_euler=sofa_matrix.to_euler()
    print('SOFA_BOUNDS',tuple(low),tuple(high),flush=True)
    # 导入透明材质按薄玻璃处理，使窗光进入，同时保留少量反射。
    for mat in bpy.data.materials:
        if not mat.use_nodes:continue
        bsdf=next((n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED'),None)
        if not bsdf:continue
        if 'glass' in mat.name.lower():
            nodes=mat.node_tree.nodes;links=mat.node_tree.links;output=next(n for n in nodes if n.type=='OUTPUT_MATERIAL')
            transparent=nodes.new('ShaderNodeBsdfTransparent');glossy=nodes.new('ShaderNodeBsdfGlossy');glossy.inputs['Roughness'].default_value=.035
            mix=nodes.new('ShaderNodeMixShader');mix.inputs[0].default_value=.045
            links.new(transparent.outputs[0],mix.inputs[1]);links.new(glossy.outputs[0],mix.inputs[2]);links.new(mix.outputs[0],output.inputs['Surface'])
        elif 'fabric' in mat.name.lower() or 'bedding' in mat.name.lower():
            bsdf.inputs['Roughness'].default_value=.87
            bsdf.inputs['Sheen Weight'].default_value=.12
        elif 'floor' in mat.name.lower():bsdf.inputs['Roughness'].default_value=.47
        elif 'paint' in mat.name.lower():bsdf.inputs['Roughness'].default_value=.85
        elif 'mirror' in mat.name.lower():
            bsdf.inputs['Metallic'].default_value=1;bsdf.inputs['Roughness'].default_value=.025
    scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.device='CPU'
    scene.cycles.samples=96;scene.cycles.use_adaptive_sampling=True;scene.cycles.adaptive_threshold=.025
    scene.cycles.use_denoising=True;scene.cycles.max_bounces=10;scene.cycles.diffuse_bounces=6
    scene.cycles.glossy_bounces=4;scene.cycles.transmission_bounces=8;scene.cycles.transparent_max_bounces=12
    scene.cycles.sample_clamp_indirect=8
    scene.render.threads_mode='FIXED';scene.render.threads=10
    scene.render.use_persistent_data=True
    scene.world.use_nodes=True
    nodes=scene.world.node_tree.nodes;links=scene.world.node_tree.links
    env=nodes.new('ShaderNodeTexEnvironment');env.image=bpy.data.images.load(str(ROOT/'realism-assets/outside.hdr'))
    links.new(env.outputs['Color'],nodes.get('Background').inputs['Color']);nodes.get('Background').inputs['Strength'].default_value=.75
    bpy.ops.object.light_add(type='SUN',location=(-3,-22,8));sun=bpy.context.object
    sun.data.energy=1.4;sun.data.angle=math.radians(10)
    sun.rotation_euler=(Vector((3.3,-8.8,0))-sun.location).to_track_quat('-Z','Y').to_euler()
    # 大面窗光与低功率顶灯补光，统一在路径追踪中计算完整反弹和遮挡。
    add_area('South_Window',(2,-12.8,2.3),(2,-8,1),160,3,(.92,.95,1))
    add_area('Living_Light',(1.8,-9.2,2.8),(1.8,-9.2,0),32,1.4)
    add_area('Dining_Light',(1.9,-5.9,2.65),(1.9,-5.9,0),26,.65)
    for name,px,pz in [('Master',8.1,9.2),('South_Bedroom',5.1,9.1),('North_Bedroom',6.55,5.2),
                       ('Kitchen',3.3,3.9),('Entrance',1.1,2.8),('Study',3.0,1.2),('Bath_West',4.5,5.8),('Bath_East',8.5,5.8)]:
        add_area(name+'_Light',(px,-pz,2.78),(px,-pz,0),24 if 'Bath' not in name else 38,.60)
    scene.view_settings.view_transform='AgX';scene.view_settings.look='AgX - Medium High Contrast';scene.view_settings.exposure=1.15
    scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGB';scene.render.image_settings.color_depth='8'
    bpy.ops.object.camera_add(location=(1.25,-8.3,1.55));camera=bpy.context.object;camera.name='Tour_Camera';scene.camera=camera
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'furnished-panorama.blend'))
    return scene,camera

if '--detailed' in sys.argv:
    from panorama_detail import upgrade_scene,apply_theme
    base=OUT/'v2/detailed-base.blend';base.parent.mkdir(exist_ok=True)
    if not base.exists() or '--rebuild-details' in sys.argv:
        bpy.ops.wm.open_mainfile(filepath=str(OUT/'furnished-panorama.blend'))
        upgrade_scene(json.loads((ROOT/'panorama-detail-layout.json').read_text(encoding='utf-8')))
        bpy.ops.wm.save_as_mainfile(filepath=str(base))
    else:bpy.ops.wm.open_mainfile(filepath=str(base))
    theme=sys.argv[sys.argv.index('--theme')+1] if '--theme' in sys.argv else 'warm'
    apply_theme(theme);scene=bpy.context.scene;scene.render.threads=12;camera=scene.camera;OUT=OUT/'v2'/theme;OUT.mkdir(exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'scene.blend'))
elif '--resume' in sys.argv:
    bpy.ops.wm.open_mainfile(filepath=str(OUT/'furnished-panorama.blend'));scene=bpy.context.scene;camera=scene.camera
else:scene,camera=setup()

# 离线渲染使用完整结构墙表面，避免毫米级湿区饰面层造成局部黑块。
for obj in scene.objects:
    if obj.type=='MESH' and any(slot.material and slot.material.name=='装修_wetWall' for slot in obj.material_slots):obj.hide_render=True

if '--preview' in sys.argv:
    camera.data.type='PERSP';camera.data.lens=25
    selected=sys.argv[sys.argv.index('--preview-room')+1] if '--preview-room' in sys.argv else 'living'
    point=next(p for p in json.loads((ROOT/'panorama-points.json').read_text(encoding='utf-8')) if p['id']==selected)
    px,py,pz=point['position'];camera.location=(px,-pz,py)
    tx,ty,tz=point['look'];camera.rotation_euler=(Vector((tx,-tz,ty))-camera.location).to_track_quat('-Z','Y').to_euler()
    scene.render.resolution_x=1100;scene.render.resolution_y=800;scene.render.resolution_percentage=100;scene.cycles.samples=32
    scene.render.filepath=str(OUT/(selected+'-preview.png'));bpy.ops.render.render(write_still=True)
else:
    points=json.loads((ROOT/'panorama-points.json').read_text(encoding='utf-8'))
    selected=set(sys.argv[sys.argv.index('--point')+1].split(',')) if '--point' in sys.argv else None
    for point in points:
        if selected and point['id'] not in selected:continue
        target=OUT/(point['id']+'.png')
        if target.exists() and '--overwrite' not in sys.argv:continue
        px,py,pz=point['position'];camera.location=(px,-pz,py)
        # 中心方向沿 Blender +X，符合标准经纬全景环境图的方向定义。
        camera.rotation_euler=(math.pi/2,0,-math.pi/2);camera.data.type='PANO';camera.data.panorama_type='EQUIRECTANGULAR'
        resolution=int(sys.argv[sys.argv.index('--resolution')+1]) if '--resolution' in sys.argv else 4096 if '--detailed' in sys.argv else 3072
        scene.render.resolution_x=resolution;scene.render.resolution_y=resolution//2;scene.render.resolution_percentage=100
        scene.cycles.samples=int(sys.argv[sys.argv.index('--samples')+1]) if '--samples' in sys.argv else 48
        scene.render.filepath=str(target);print('POINT_START',point['id'],flush=True);bpy.ops.render.render(write_still=True)
        print('POINT_COMPLETE',point['id'],flush=True)
