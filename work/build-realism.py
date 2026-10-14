"""生成精细客厅资产、固定结构间接光图和客厅环境光；Blender后台运行。"""
import bpy
import math
import json
import base64
import sys
from pathlib import Path
from mathutils import Vector

ROOT=Path(__file__).resolve().parent
OUT=ROOT/'realism-assets'
OUT.mkdir(exist_ok=True)

def clear_scene():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)

def material(name,color,roughness=.7,metallic=0):
    mat=bpy.data.materials.new(name);mat.use_nodes=True
    bsdf=mat.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value=(*color,1)
    bsdf.inputs['Roughness'].default_value=roughness
    bsdf.inputs['Metallic'].default_value=metallic
    return mat

def cube(name,dimensions,location,mat,bevel=.015):
    bpy.ops.mesh.primitive_cube_add(size=1,location=location)
    obj=bpy.context.object;obj.name=name;obj.dimensions=dimensions
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if bevel:
        modifier=obj.modifiers.new('Rounded_Edges','BEVEL');modifier.width=bevel;modifier.segments=3
        bpy.ops.object.modifier_apply(modifier=modifier.name)
        modifier=obj.modifiers.new('Weighted_Normals','WEIGHTED_NORMAL')
        bpy.ops.object.modifier_apply(modifier=modifier.name)
    obj.data.materials.append(mat)
    return obj

def spow(value,power):return math.copysign(abs(value)**power,value)

def cushion(name,size,position,mat,seed=0,exponent=.38,rotation=(0,0,0)):
    # 超椭球软包带局部压陷和边缘褶皱，不使用圆角盒子作为软包表面。
    nu,nv=40,64;verts=[];faces=[]
    for i in range(nu+1):
        latitude=-math.pi/2+math.pi*i/nu
        c,s=math.cos(latitude),math.sin(latitude)
        for j in range(nv):
            longitude=2*math.pi*j/nv
            px=spow(c,exponent)*spow(math.cos(longitude),exponent)*size[0]/2
            py=spow(c,exponent)*spow(math.sin(longitude),exponent)*size[1]/2
            pz=spow(s,exponent)*size[2]/2
            edge=(abs(px)/(size[0]/2))**10+(abs(py)/(size[1]/2))**10
            ripple=(.0025*math.sin(longitude*15+seed)+.0016*math.sin(longitude*27+latitude*9))*min(1,edge)*abs(s)
            dent=.007*math.exp(-((px/(size[0]*.3))**2+(py/(size[1]*.35))**2))*max(0,s)
            point=[px,py,pz+ripple-dent]
            thin=min(range(3),key=lambda k:size[k]);axes=[k for k in range(3) if k!=thin]
            u=point[axes[0]]/(size[axes[0]]/2);v=point[axes[1]]/(size[axes[1]]/2)
            side=point[thin]/(size[thin]/2)
            fold=.006*math.sin(u*29+v*6+seed)*math.exp(-((1-abs(v))/.23)**2)
            fold+=.004*math.sin(v*37+u*8+seed)*math.exp(-((1-abs(u))/.22)**2)
            press=.014*math.exp(-((u/.68)**2+(v/.64)**2))
            point[thin]+=(1 if side>=0 else -1)*(fold-press)*abs(side)**4
            verts.append(tuple(point))
    for i in range(nu):
        for j in range(nv):
            a=i*nv+j;b=i*nv+(j+1)%nv;faces.append((a,b,b+nv,a+nv))
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.update()
    obj=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(obj)
    obj.location=position;obj.rotation_euler=rotation;mesh.materials.append(mat)
    for polygon in mesh.polygons:polygon.use_smooth=True
    uv=mesh.uv_layers.new(name='FabricUV')
    for polygon in mesh.polygons:
        for li in polygon.loop_indices:
            v=mesh.vertices[mesh.loops[li].vertex_index].co
            # 以米为基准贴织物，避免每个软包都把纹理拉满一遍。
            if abs(polygon.normal.z)>.5:uv.data[li].uv=(v.x*2,v.y*2)
            elif abs(polygon.normal.y)>.5:uv.data[li].uv=(v.x*2,v.z*2)
            else:uv.data[li].uv=(v.y*2,v.z*2)
    return obj

def piping(name,w,d,height,position,mat):
    curve=bpy.data.curves.new(name,'CURVE');curve.dimensions='3D';curve.bevel_depth=.0022;curve.bevel_resolution=1
    spline=curve.splines.new('POLY');spline.points.add(95)
    for i,p in enumerate(spline.points):
        t=i*2*math.pi/96;p.co=(spow(math.cos(t),.35)*w/2,spow(math.sin(t),.35)*d/2,height,1)
    spline.use_cyclic_u=True
    obj=bpy.data.objects.new(name,curve);bpy.context.collection.objects.link(obj);obj.location=position;curve.materials.append(mat)
    bpy.context.view_layer.objects.active=obj;obj.select_set(True)
    bpy.ops.object.convert(target='MESH');obj.select_set(False)

def build_sofa():
    clear_scene()
    fabric=material('Studio_Fabric',(.70,.66,.58),.92)
    accent=material('Studio_Accent',(.24,.36,.29),.93)
    bedding=material('Studio_Bedding',(.81,.77,.68),.94)
    seam=material('Studio_Seam',(.52,.49,.43),.96)
    oak=material('Studio_Oak',(.48,.31,.16),.52)
    metal=material('Studio_DarkMetal',(.04,.05,.045),.35,.65)
    cube('Oak_Base',(2.08,.73,.13),(0,0,.245),oak,.025)
    for px in [-.88,.88]:
        for py in [-.265,.265]:cube('Foot',(.036,.036,.17),(px,py,.105),metal,.003)
    cushion('Base_Upholstery',(2.10,.77,.20),(0,0,.35),fabric,1,.30)
    for side in [-1,1]:
        cushion('Soft_Arm',(.20,.85,.48),(side*1.015,0,.575),fabric,side,.32)
        cushion('Seat',(.945,.64,.15),(side*.49,-.075,.49),fabric,side+3,.29)
        piping('Seat_Welt',.935,.63,.016,(side*.49,-.075,.49),seam)
        cushion('Back',(.98,.19,.52),(side*.49,.277,.72),fabric,side+5,.35,(-.12,0,0))
    cushion('Sage_Pillow',(.40,.115,.40),(-.65,.06,.76),accent,11,.35,(-.14,.12,-.11))
    cushion('Linen_Pillow',(.41,.12,.38),(.65,.075,.75),bedding,14,.35,(-.20,-.12,.10))
    verts=[];faces=[];nx,ny=34,44
    for i in range(nx+1):
        px=.34+.55*i/nx
        for j in range(ny+1):
            py=.23-.75*j/ny
            pz=.577+.012*math.sin(px*43+py*5)+.004*math.sin(py*57)
            if py<-.34:pz-=(-.34-py)*1.65
            verts.append((px,py,pz))
    for i in range(nx):
        for j in range(ny):
            a=i*(ny+1)+j;faces.append((a,a+1,a+ny+2,a+ny+1))
    me=bpy.data.meshes.new('Draped_Throw');me.from_pydata(verts,[],faces);me.update()
    ob=bpy.data.objects.new('Draped_Throw',me);bpy.context.collection.objects.link(ob);me.materials.append(bedding)
    for p in me.polygons:p.use_smooth=True
    uv=me.uv_layers.new(name='FabricUV')
    for p in me.polygons:
        for li in p.loop_indices:
            co=me.vertices[me.loops[li].vertex_index].co;uv.data[li].uv=(co.x*2,co.y*2)
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(filepath=str(OUT/'tailored-sofa.glb'),export_format='GLB',use_selection=True,
        export_apply=True,export_materials='EXPORT',export_extras=True)
    print('SOFA_COMPLETE',flush=True)

def bake_architecture():
    clear_scene()
    bpy.ops.import_scene.gltf(filepath=str(ROOT.parent/'outputs/apartment-shell.glb'))
    objects=[o for o in bpy.context.scene.objects if o.type=='MESH']
    floor=next(o for o in objects if o.name=='Floor_Slab')
    ceiling=floor.copy();ceiling.data=floor.data.copy();ceiling.name='Ceiling_Interior';ceiling.location.z+=3.06
    bpy.context.collection.objects.link(ceiling);objects.append(ceiling)
    paint=material('Bake_Warm_Wall',(.86,.83,.78),.88)
    floor_mat=material('Bake_Oak_Floor',(1,1,1),.72)
    nodes=floor_mat.node_tree.nodes;links=floor_mat.node_tree.links
    texture=nodes.new('ShaderNodeTexImage');texture.image=bpy.data.images.load(str(OUT/'wood-diff.jpg'))
    uv_node=nodes.new('ShaderNodeUVMap');uv_node.uv_map='UVMap'
    links.new(uv_node.outputs['UV'],texture.inputs['Vector']);links.new(texture.outputs['Color'],nodes.get('Principled BSDF').inputs['Base Color'])
    for obj in objects:
        obj.data.materials.clear();obj.data.materials.append(floor_mat if obj==floor else paint)
        original=obj.data.uv_layers[0] if obj.data.uv_layers else obj.data.uv_layers.new(name='UVMap')
        original.name='UVMap'
        if obj==floor:
            for li,loop in enumerate(obj.data.loops):
                p=obj.data.vertices[loop.vertex_index].co;original.data[li].uv=(p.x/2.4,-p.y/2.4)
        obj.data.uv_layers.new(name='BakeUV');obj.data.uv_layers.active_index=1
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects:obj.select_set(True)
    bpy.context.view_layer.objects.active=floor
    bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(66),island_margin=.008)
    bpy.ops.object.mode_set(mode='OBJECT')
    scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=48
    scene.cycles.max_bounces=6;scene.cycles.diffuse_bounces=4;scene.cycles.glossy_bounces=2
    scene.world.use_nodes=True
    wn=scene.world.node_tree.nodes;wl=scene.world.node_tree.links
    env=wn.new('ShaderNodeTexEnvironment');env.image=bpy.data.images.load(str(OUT/'outside.hdr'))
    wl.new(env.outputs['Color'],wn.get('Background').inputs['Color']);wn.get('Background').inputs['Strength'].default_value=.4
    bpy.ops.object.light_add(type='SUN',location=(-3,-22,8))
    sun=bpy.context.object;sun.data.energy=2.5;sun.data.angle=math.radians(5)
    direction=Vector((3.3,-8.8,0))-sun.location;sun.rotation_euler=direction.to_track_quat('-Z','Y').to_euler()
    image=bpy.data.images.new('Warm_Indirect_Light',width=1024,height=1024,float_buffer=True)
    image.colorspace_settings.name='Linear Rec.709'
    for mat in [paint,floor_mat]:
        node=mat.node_tree.nodes.new('ShaderNodeTexImage');node.image=image;mat.node_tree.nodes.active=node
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects:obj.select_set(True)
    bpy.context.view_layer.objects.active=floor
    print('BAKE_START',len(objects),flush=True)
    bpy.ops.object.bake(type='DIFFUSE',pass_filter={'INDIRECT'},margin=5,use_clear=True,uv_layer='BakeUV')
    image.filepath_raw=str(OUT/'indirect.hdr');image.file_format='HDR';image.save()
    geometry={}
    for obj in objects:
        me=obj.data;me.calc_loop_triangles()
        out={k:[] for k in ['position','normal','uv','uv1']}
        for triangle in me.loop_triangles:
            for li in triangle.loops:
                p=me.vertices[me.loops[li].vertex_index].co;n=me.corner_normals[li].vector
                out['position']+=list((p.x,p.z,-p.y));out['normal']+=list((n.x,n.z,-n.y))
                uv=me.uv_layers['UVMap'].data[li].uv;out['uv']+=list((uv.x,1-uv.y))
                uv=me.uv_layers['BakeUV'].data[li].uv;out['uv1']+=list(uv)
        geometry[obj.name]=out
    (OUT/'architecture.json').write_text(json.dumps(geometry,separators=(',',':')),encoding='utf-8')
    (OUT/'indirect.json').write_text(json.dumps({'hdr':base64.b64encode((OUT/'indirect.hdr').read_bytes()).decode()}),encoding='utf-8')
    print('BAKE_COMPLETE',flush=True)
    # 环境探针渲染只用于家具照明，网页窗外采用独立的室外HDR。
    bpy.ops.object.select_all(action='DESELECT')
    bpy.ops.object.camera_add(location=(1.60,-9.12,1.5))
    camera=bpy.context.object;camera.rotation_euler=(math.pi/2,0,0);camera.data.type='PANO';camera.data.panorama_type='EQUIRECTANGULAR'
    scene.camera=camera;scene.render.resolution_x=1024;scene.render.resolution_y=512;scene.render.resolution_percentage=100
    scene.cycles.samples=32;scene.render.image_settings.file_format='HDR';scene.render.image_settings.color_mode='RGB'
    scene.view_settings.view_transform='Raw';scene.render.filepath=str(OUT/'room-environment.hdr')
    bpy.ops.render.render(write_still=True)
    (OUT/'room-environment.json').write_text(json.dumps({'hdr':base64.b64encode((OUT/'room-environment.hdr').read_bytes()).decode()}),encoding='utf-8')
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'living-bake.blend'))
    print('ENVIRONMENT_COMPLETE',flush=True)

build_sofa()
if '--sofa-only' not in sys.argv:bake_architecture()
