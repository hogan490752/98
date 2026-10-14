"""全景专用的床品、厨具、洁具和三套物理材质，保持已确认户型与设备位置。"""
import bpy
import bmesh
import math
from pathlib import Path
from mathutils import Vector

ROOT=Path(__file__).resolve().parent
SURFACES=ROOT/'realism-assets/surfaces'
THEMES={
    'warm':{'name':'暖木现代','paint':'eee9df','cabinet':'ded8cb','cloth':'e5dece','accent':'64796a','wood':'d4b085','metal':'ad8c58','sofa':'c8c0af','light':(1,.91,.77)},
    'minimal':{'name':'清爽极简','paint':'eeeFEB','cabinet':'e4e7e4','cloth':'e1e5e5','accent':'788b91','wood':'d1d0c6','metal':'747f81','sofa':'c3ccce','light':(.94,.97,1)},
    'urban':{'name':'都市深色','paint':'bdb6ab','cabinet':'414743','cloth':'a6a59b','accent':'425354','wood':'74543a','metal':'938464','sofa':'a86e42','light':(1,.82,.62)}
}

def linear(hexcolor):
    values=[int(hexcolor[i:i+2],16)/255 for i in (0,2,4)]
    return tuple(v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in values)

def material(name,color='e5e5df',rough=.5,metal=0):
    mat=bpy.data.materials.new(name);mat.use_nodes=True
    bsdf=mat.node_tree.nodes.get('Principled BSDF');bsdf.inputs['Base Color'].default_value=(*linear(color),1)
    bsdf.inputs['Roughness'].default_value=rough;bsdf.inputs['Metallic'].default_value=metal
    return mat

def cube(name,size,position,mat,parent=None,bevel=.008):
    bpy.ops.mesh.primitive_cube_add(size=1,location=position);obj=bpy.context.object;obj.name=name;obj.dimensions=size
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if bevel:
        mod=obj.modifiers.new('Soft_Edge','BEVEL');mod.width=bevel;mod.segments=3
        bpy.ops.object.modifier_apply(modifier=mod.name)
        mod=obj.modifiers.new('Face_Normals','WEIGHTED_NORMAL');bpy.ops.object.modifier_apply(modifier=mod.name)
    obj.data.materials.append(mat);obj.parent=parent;return obj

def mesh_object(name,verts,faces,mat,parent=None):
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.update()
    obj=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(obj);obj.parent=parent;mesh.materials.append(mat)
    for face in mesh.polygons:face.use_smooth=True
    uv=mesh.uv_layers.new(name='SurfaceUV')
    for face in mesh.polygons:
        for loop in face.loop_indices:
            p=mesh.vertices[mesh.loops[loop].vertex_index].co;uv.data[loop].uv=(p.x,p.y)
    return obj

def tube(name,points,radius,mat,parent=None):
    curve=bpy.data.curves.new(name,'CURVE');curve.dimensions='3D';curve.bevel_depth=radius;curve.bevel_resolution=3
    spline=curve.splines.new('POLY');spline.points.add(len(points)-1)
    for node,p in zip(spline.points,points):node.co=(*p,1)
    obj=bpy.data.objects.new(name,curve);bpy.context.collection.objects.link(obj);obj.parent=parent;curve.materials.append(mat);return obj

def ring(name,rx,ry,z,mat,parent=None,cy=0,radius=.003):
    return tube(name,[(math.cos(a)*rx,cy+math.sin(a)*ry,z) for a in [i*2*math.pi/96 for i in range(97)]],radius,mat,parent)

def remove_faces(box,roles):
    # 仅移除定位盒内的旧设备面，不触碰主体结构或定位盒外的柜体。
    count=0;low,high=box
    for obj in list(bpy.context.scene.objects):
        if obj.type!='MESH' or not any(s.material and s.material.name.split('.')[0] in roles for s in obj.material_slots):continue
        bm=bmesh.new();bm.from_mesh(obj.data);delete=[]
        for face in bm.faces:
            points=[obj.matrix_world@v.co for v in face.verts]
            if all(all(low[i]-.003<=p[i]<=high[i]+.003 for i in range(3)) for p in points):delete.append(face)
        if delete:
            if obj.data.users>1:obj.data=obj.data.copy()
            count+=len(delete);bmesh.ops.delete(bm,geom=delete,context='FACES');bm.to_mesh(obj.data);obj.data.update()
        bm.free()
    return count

def pillow(parent,mat,seam,width,cy,seed):
    nx,ny=32,24;verts=[];faces=[]
    for side in [1,-1]:
        for i in range(nx+1):
            u=-1+2*i/nx
            for j in range(ny+1):
                v=-1+2*j/ny
                bulge=(max(0,1-u*u)*max(0,1-v*v))**.55
                fold=.0045*math.sin(u*31+v*12+seed)*(abs(v)**7)+.0025*math.sin(v*41+u*7)*(abs(u)**7)
                verts.append((u*width/2,v*.195+cy,.580+side*(.080*bulge+fold)))
    stride=ny+1;layer=(nx+1)*(ny+1)
    for side in range(2):
        for i in range(nx):
            for j in range(ny):
                a=side*layer+i*stride+j;quad=(a,a+stride,a+stride+1,a+1);faces.append(quad if side==0 else quad[::-1])
    # 上下表面沿缝线封口，保留可见的软包弧度。
    outline=[i*stride for i in range(nx+1)]+[nx*stride+j for j in range(1,ny+1)]+[i*stride+ny for i in range(nx-1,-1,-1)]+[j for j in range(ny-1,0,-1)]
    for a,b in zip(outline,outline[1:]+outline[:1]):faces.append((a,b,b+layer,a+layer))
    obj=mesh_object('Detail_Pillow',verts,faces,mat,parent)
    mod=obj.modifiers.new('Pillow_Subdivision','SUBSURF');mod.levels=1
    tube('Pillow_Seam',[verts[i] for i in outline+[outline[0]]],.0015,seam,obj)
    return obj

def detailed_bed(old,w,d,cloth,wood,upholstery,seam):
    matrix=old.matrix_world.copy();items=[old]+list(old.children_recursive)
    for item in reversed(items):bpy.data.objects.remove(item,do_unlink=True)
    root=bpy.data.objects.new('Detail_Bed',None);bpy.context.collection.objects.link(root);root.matrix_world=matrix
    cube('Bed_Frame',(w+.035,d,.19),(0,0,.19),wood,root,.018)
    for px in [-w/2+.09,w/2-.09]:
        for py in [-d/2+.11,d/2-.11]:cube('Bed_Foot',(.055,.055,.10),(px,py,.052),wood,root,.005)
    mattress=cube('Mattress',(w,d,.225),(0,0,.386),cloth,root,.055)
    cube('Upholstered_Headboard',(w+.08,.105,.78),(0,d/2-.055,.665),upholstery,root,.025)
    for px in [-w*.28,w*.28]:
        p=pillow(root,cloth,seam,min(.64,w*.45),d/2-.29,px*7);p.location.x=px
    # 真实重力/碰撞计算被面的下垂；冻结结果后不在渲染期间反复模拟。
    collider_collection=bpy.data.collections.new('Cloth_Collider');bpy.context.scene.collection.children.link(collider_collection)
    collider_collection.objects.link(mattress);mattress.modifiers.new('Mattress_Collision','COLLISION')
    nx,ny=48,62;verts=[];faces=[]
    for i in range(nx+1):
        px=(i/nx-.5)*(w+.30)
        for j in range(ny+1):
            py=-d/2-.19+j/ny*(d-.39)
            pz=.54 if j==ny else .61+.018*math.sin(px*14+py*6)+.008*math.sin(py*21+px*9)
            verts.append((px,py,pz))
    for i in range(nx):
        for j in range(ny):
            a=i*(ny+1)+j;faces.append((a,a+ny+1,a+ny+2,a+1))
    blanket=mesh_object('Detail_Duvet',verts,faces,cloth,root)
    pins=blanket.vertex_groups.new(name='Head_Tuck');pins.add([i*(ny+1)+ny for i in range(nx+1)],1,'REPLACE')
    sim=blanket.modifiers.new('Duvet_Gravity','CLOTH');sim.settings.quality=5;sim.settings.mass=.35
    sim.settings.tension_stiffness=18;sim.settings.compression_stiffness=18;sim.settings.shear_stiffness=8;sim.settings.bending_stiffness=.35
    sim.settings.vertex_group_mass=pins.name;sim.collision_settings.collection=collider_collection;sim.collision_settings.distance_min=.008
    sim.collision_settings.use_self_collision=True;sim.collision_settings.self_distance_min=.004;sim.collision_settings.collision_quality=3
    sim.point_cache.frame_start=1;sim.point_cache.frame_end=55
    scene=bpy.context.scene;scene.frame_set(1)
    for frame in range(1,56):scene.frame_set(frame)
    deps=bpy.context.evaluated_depsgraph_get();evaluated=blanket.evaluated_get(deps)
    baked=bpy.data.meshes.new_from_object(evaluated);blanket.modifiers.clear();blanket.data=baked
    # 边缘厚度与柔软曲面让近看不再是一张没有体积的平面。
    sub=blanket.modifiers.new('Duvet_Surface','SUBSURF');sub.levels=1
    solid=blanket.modifiers.new('Duvet_Thickness','SOLIDIFY');solid.thickness=.025;solid.offset=1
    runner_material=bpy.data.materials.get('Detail_Runner') or material('Detail_Runner','64796a',.92)
    blanket.modifiers.new('Runner_Collision','COLLISION');collider_collection.objects.link(blanket)
    nx2,ny2=42,16;rv=[];rf=[]
    for i in range(nx2+1):
        for j in range(ny2+1):rv.append(((i/nx2-.5)*(w+.26),-d*.28+(j/ny2-.5)*.46,.68+.012*math.sin(i*.43+j*.31)))
    for i in range(nx2):
        for j in range(ny2):a=i*(ny2+1)+j;rf.append((a,a+ny2+1,a+ny2+2,a+1))
    runner=mesh_object('Draped_Bed_Runner',rv,rf,runner_material,root)
    sim2=runner.modifiers.new('Runner_Gravity','CLOTH');sim2.settings.quality=4;sim2.settings.mass=.25;sim2.settings.bending_stiffness=.45
    sim2.collision_settings.collection=collider_collection;sim2.collision_settings.distance_min=.006;sim2.point_cache.frame_start=1;sim2.point_cache.frame_end=45
    scene.frame_set(1)
    for frame in range(1,46):scene.frame_set(frame)
    runner.data=bpy.data.meshes.new_from_object(runner.evaluated_get(bpy.context.evaluated_depsgraph_get()));runner.modifiers.clear()
    sub=runner.modifiers.new('Runner_Surface','SUBSURF');sub.levels=1
    solid=runner.modifiers.new('Runner_Thickness','SOLIDIFY');solid.thickness=.006;solid.offset=1
    scene.frame_set(1);print('DETAILED_BED_COMPLETE',w,d,len(baked.vertices),flush=True)
    return root

def toilet(px,pz,rotation,ceramic,metal):
    roles=['装修_white','装修_dark','装修_metal'];removed=remove_faces(((px-.37,-pz-.24,.02),(px+.37,-pz+.24,.80)),roles)
    root=bpy.data.objects.new('Detail_Toilet',None);bpy.context.collection.objects.link(root);root.location=(px,-pz,0);root.rotation_euler.z=rotation
    verts=[];faces=[];segments=96
    profile=[(.12,.16,.003),(.12,.17,.10),(.135,.18,.24),(.175,.235,.35),(.177,.245,.405),(.172,.24,.43),(.145,.211,.432),(.13,.18,.38),(.065,.105,.30)]
    for rx,ry,zz in profile:
        for i in range(segments):a=i*2*math.pi/segments;verts.append((rx*math.cos(a),-.055+ry*math.sin(a),zz))
    for j in range(len(profile)-1):
        for i in range(segments):a=j*segments+i;b=j*segments+(i+1)%segments;faces.append((a,b,b+segments,a+segments))
    mesh_object('Ceramic_Bowl_And_Base',verts,faces,ceramic,root)
    ring('Seat_Outer',.175,.244,.454,ceramic,root,-.055,.010)
    # 盖板微弧且与座圈分开，代替旧球体和黑色圆片。
    lid_verts=[];lid_faces=[]
    for rx,ry,zz in [(.164,.229,.458),(.170,.238,.463),(.163,.23,.481),(.07,.10,.486)]:
        for i in range(segments):a=i*2*math.pi/segments;lid_verts.append((rx*math.cos(a),-.055+ry*math.sin(a),zz))
    for j in range(3):
        for i in range(segments):a=j*segments+i;b=j*segments+(i+1)%segments;lid_faces.append((a,b,b+segments,a+segments))
    lid_verts.append((0,-.055,.487));center=len(lid_verts)-1
    for i in range(segments):lid_faces.append((3*segments+i,3*segments+(i+1)%segments,center))
    mesh_object('Seat_Lid',lid_verts,lid_faces,ceramic,root)
    cube('Cistern',(.335,.152,.365),(0,.232,.535),ceramic,root,.023)
    cube('Flush_Plate',(.105,.055,.008),(0,.232,.724),metal,root,.006)
    cube('Flush_Divider',(.0015,.051,.002),(0,.232,.729),metal,root,.0005)
    print('TOILET_REPLACED',px,removed,flush=True)

def kitchen(layout,steel,dark,glass):
    px=layout['x'];sink=layout['sinkZ'];hob=layout['hobZ']
    removed=remove_faces(((px-.235,-sink-.26,.858),(px+.235,-sink+.26,1.30)),['装修_dark','装修_metal'])
    removed+=remove_faces(((px-.25,-hob-.32,.857),(px+.25,-hob+.32,.91)),['装修_dark','装修_metal'])
    # 对台面和柜体做真正的盆腔切口，防止新水槽再次被实心台面填平。
    cutter=cube('Sink_Cut',(.37,.445,.32),(px,-sink,.80),dark,None,.018)
    for obj in list(bpy.context.scene.objects):
        if obj==cutter or obj.type!='MESH' or not any(s.material and s.material.name in ['装修_stone','装修_cabinet'] for s in obj.material_slots):continue
        points=[obj.matrix_world@Vector(p) for p in obj.bound_box]
        if any(max(p[i] for p in points)<[px-.20,-sink-.25,.60][i] or min(p[i] for p in points)>[px+.20,-sink+.25,1.0][i] for i in range(3)):continue
        if obj.data.users>1:obj.data=obj.data.copy()
        bm=bmesh.new();bm.from_mesh(obj.data);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.00001);bm.to_mesh(obj.data);bm.free()
        mod=obj.modifiers.new('Sink_Opening','BOOLEAN');mod.operation='DIFFERENCE';mod.solver='EXACT';mod.object=cutter
        bpy.context.view_layer.objects.active=obj;bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.data.objects.remove(cutter,do_unlink=True)
    root=bpy.data.objects.new('Detail_Sink',None);bpy.context.collection.objects.link(root);root.location=(px,-sink,0);root.rotation_euler.z=-math.pi/2
    profile=[(.24,.20,.873),(.222,.182,.878),(.216,.175,.858),(.19,.15,.737),(.16,.118,.700),(.01,.01,.700)]
    verts=[];faces=[];n=96
    for rx,ry,zz in profile:
        for i in range(n):
            a=i*2*math.pi/n;cs,ss=math.cos(a),math.sin(a)
            verts.append((math.copysign(abs(cs)**.24,cs)*rx,math.copysign(abs(ss)**.24,ss)*ry,zz))
    for j in range(len(profile)-1):
        for i in range(n):a=j*n+i;b=j*n+(i+1)%n;faces.append((a,b,b+n,a+n))
    mesh_object('Stainless_Sink_Bowl',verts,faces,steel,root)
    ring('Drain_Rim',.023,.023,.701,steel,root,0,.0025)
    cube('Drain',(.034,.034,.004),(0,0,.700),dark,root,.002)
    points=[]
    for i in range(40):
        t=i/39;points.append((0,.18-.19*t,.88+.34*math.sin(t*math.pi*.75)))
    tube('Mixer_Spout',points,.012,steel,root);cube('Mixer_Base',(.038,.04,.05),(0,.18,.9),steel,root,.009)
    cube('Mixer_Lever',(.06,.012,.008),(.03,.17,.949),steel,root,.003)
    cube('Mixer_Stem',(.016,.016,.03),(0,.18,.938),steel,root,.004)
    hob_root=bpy.data.objects.new('Detail_Induction_Hob',None);bpy.context.collection.objects.link(hob_root);hob_root.location=(px,-hob,0);hob_root.rotation_euler.z=-math.pi/2
    cube('Ceramic_Glass_Cooktop',(.58,.44,.013),(0,0,.879),glass,hob_root,.005)
    markings=material('Cooktop_Markings','696f72',.55)
    for xx in [-.145,.145]:
        for yy in [-.095,.095]:
            r=.068 if xx<0 else .055
            circle=ring('Induction_Zone',r,r,.887,markings,hob_root,yy,.0012);circle.location.x=xx
    for xx in [-.13,-.065,0,.065,.13]:cube('Touch_Control',(.012,.002,.001),(xx,-.184,.8875),markings,hob_root,.0004)
    # 日常物品也用有厚度的几何，补操作尺度和可辨认的金属反射。
    board=cube('Cutting_Board',(.225,.30,.018),(px-.02,-(sink+hob)/2,.879),bpy.data.materials['装修_wood'],None,.009)
    pot_verts=[];pot_faces=[];n=64
    for r,zz in [(.077,.889),(.085,.900),(.091,1.005),(.088,1.013)]:
        for i in range(n):a=i*2*math.pi/n;pot_verts.append((-.145+r*math.cos(a),.095+r*math.sin(a),zz))
    for j in range(3):
        for i in range(n):a=j*n+i;b=j*n+(i+1)%n;pot_faces.append((a,b,b+n,a+n))
    mesh_object('Stainless_Saucepan',pot_verts,pot_faces,steel,hob_root)
    lid=ring('Saucepan_Lid',.09,.09,1.016,steel,hob_root,.095,.005);lid.location.x=-.145
    lv=[(-.145+.09*math.cos(i*2*math.pi/n),.095+.09*math.sin(i*2*math.pi/n),1.017) for i in range(n)]+[(-.145,.095,1.030)]
    mesh_object('Saucepan_Lid_Disc',lv,[(n,i,(i+1)%n) for i in range(n)],steel,hob_root)
    cube('Saucepan_Lid_Knob',(.028,.035,.025),(-.145,.095,1.037),dark,hob_root,.008)
    tube('Saucepan_Handle',[(-.230,.095,.967),(-.30,.095,.99),(-.39,.095,.99)],.011,dark,hob_root)
    print('KITCHEN_REPLACED',removed,flush=True)

def upgrade_scene(layout):
    cloth=material('Detail_Cloth','e7e3d9',.92);seam=material('Detail_Seam','d3cabb',.92)
    steel=material('Detail_Stainless','b8bfc0',.22,1);ceramic=material('Detail_Ceramic','f0f1eb',.22)
    glass=material('Detail_Appliance_Glass','151a1b',.12,.15);glass.node_tree.nodes.get('Principled BSDF').inputs['Coat Weight'].default_value=.7
    wood=bpy.data.materials['装修_wood'];upholstery=bpy.data.materials['装修_fabric'];dark=bpy.data.materials['装修_dark']
    for id,w,d in [('master-bed',1.65,2.10),('south-bed',1.22,1.90),('north-bed',1.25,1.90)]:
        old=next(o for o in bpy.context.scene.objects if o.get('id')==id);detailed_bed(old,w,d,cloth,wood,upholstery,seam)
    kitchen(layout['kitchen'],steel,dark,glass)
    for bath in layout['baths']:toilet(bath['x'],bath['z'],bath['rotation'],ceramic,steel)

def fresh_surface(mat,color,rough=.7,asset=None,scale=1,normal_strength=.12,neutral=False):
    nodes=mat.node_tree.nodes;nodes.clear();links=mat.node_tree.links
    output=nodes.new('ShaderNodeOutputMaterial');bsdf=nodes.new('ShaderNodeBsdfPrincipled');links.new(bsdf.outputs[0],output.inputs['Surface'])
    bsdf.inputs['Base Color'].default_value=(*linear(color),1);bsdf.inputs['Roughness'].default_value=rough
    if asset:
        use_uv=asset in ['rough_linen','leather_white','brown_leather']
        geo=nodes.new('ShaderNodeTexCoord' if use_uv else 'ShaderNodeNewGeometry');mapping=nodes.new('ShaderNodeVectorMath');mapping.operation='SCALE';mapping.inputs[3].default_value=scale
        links.new(geo.outputs['UV' if use_uv else 'Position'],mapping.inputs[0])
        for role in ['diff','nor_gl','rough']:
            file=SURFACES/asset/(role+'.jpg')
            if not file.exists():continue
            texture=nodes.new('ShaderNodeTexImage');texture.image=bpy.data.images.load(str(file),check_existing=True);texture.projection='FLAT' if use_uv else 'BOX';texture.projection_blend=.12
            links.new(mapping.outputs['Vector'],texture.inputs['Vector'])
            if role=='diff':
                tint=nodes.new('ShaderNodeMixRGB');tint.blend_type='MULTIPLY';tint.inputs[0].default_value=1;tint.inputs[2].default_value=(*linear(color),1)
                if neutral:
                    bw=nodes.new('ShaderNodeRGBToBW');links.new(texture.outputs['Color'],bw.inputs[0])
                    gain=nodes.new('ShaderNodeMath');gain.operation='MULTIPLY';gain.inputs[1].default_value=.18;links.new(bw.outputs[0],gain.inputs[0])
                    offset=nodes.new('ShaderNodeMath');offset.operation='ADD';offset.inputs[1].default_value=.82;links.new(gain.outputs[0],offset.inputs[0]);links.new(offset.outputs[0],tint.inputs[1])
                else:links.new(texture.outputs['Color'],tint.inputs[1])
                links.new(tint.outputs[0],bsdf.inputs['Base Color'])
            elif role=='nor_gl':
                texture.image.colorspace_settings.name='Non-Color'
                if use_uv:
                    normal=nodes.new('ShaderNodeNormalMap');normal.inputs['Strength'].default_value=normal_strength
                    links.new(texture.outputs['Color'],normal.inputs['Color']);links.new(normal.outputs[0],bsdf.inputs['Normal'])
                else:
                    # 世界BOX投射仅补细微凹凸，避免误用切线空间法线。
                    bw=nodes.new('ShaderNodeRGBToBW');links.new(texture.outputs['Color'],bw.inputs[0])
                    bump=nodes.new('ShaderNodeBump');bump.inputs['Strength'].default_value=normal_strength;bump.inputs['Distance'].default_value=.0005
                    links.new(bw.outputs[0],bump.inputs['Height']);links.new(bump.outputs[0],bsdf.inputs['Normal'])
            else:
                texture.image.colorspace_settings.name='Non-Color'
                scale_node=nodes.new('ShaderNodeMath');scale_node.operation='MULTIPLY';scale_node.inputs[1].default_value=.2 if rough>.85 else .38 if 'leather' in asset else .3
                links.new(texture.outputs['Color'],scale_node.inputs[0])
                offset=nodes.new('ShaderNodeMath');offset.operation='ADD';offset.inputs[1].default_value=.75 if rough>.85 else .22
                links.new(scale_node.outputs[0],offset.inputs[0]);links.new(offset.outputs[0],bsdf.inputs['Roughness'])
        if asset=='rough_linen':bsdf.inputs['Sheen Weight'].default_value=.22
    return bsdf

def apply_theme(id):
    theme=THEMES[id];scene=bpy.context.scene
    for role,key in [('paint','paint'),('cabinet','cabinet'),('accent','accent'),('fabric','cloth'),('bedding','cloth'),('white','paint')]:
        mat=bpy.data.materials.get('装修_'+role)
        if mat:fresh_surface(mat,theme[key],.95 if role in ['fabric','bedding'] else .86 if role=='paint' else .48,
            'rough_linen' if role in ['fabric','bedding'] else None,1.8,.12,role in ['fabric','bedding'])
    for name in ['Detail_Cloth','装修_accentFabric']:
        mat=bpy.data.materials.get(name)
        if mat:fresh_surface(mat,theme['cloth'] if name=='Detail_Cloth' else theme['accent'],.95,'rough_linen',1.8,.12,True)
    fresh_surface(bpy.data.materials['Detail_Runner'],theme['accent'],.95,'rough_linen',1.8,.12,True)
    fresh_surface(bpy.data.materials['装修_wood'],'bd936c' if id=='urban' else 'e6c79e' if id=='warm' else 'd7d7cf',.48,'black_walnut_veneer_01' if id=='urban' else 'wood_floor',.40)
    metal=bpy.data.materials['装修_metal'];bsdf=fresh_surface(metal,theme['metal'],.28);bsdf.inputs['Metallic'].default_value=.9
    fresh_surface(bpy.data.materials['装修_stone'],'e5e0d5' if id=='warm' else 'eceeeb' if id=='minimal' else '797c73',.24)
    fresh_surface(bpy.data.materials['装修_tile'],'ded9cf' if id=='warm' else 'd9dedc' if id=='minimal' else '8c918b',.34)
    floor=bpy.data.materials['装修_floor']
    if id=='minimal':fresh_surface(floor,'e7e8e3',.27,'marble_01',.44,.08,True)
    elif id=='urban':
        bsdf=fresh_surface(floor,'9f7856',.40,'black_walnut_veneer_01',.40,.12)
        nodes=floor.node_tree.nodes;links=floor.node_tree.links
        geo=nodes.new('ShaderNodeNewGeometry');split=nodes.new('ShaderNodeSeparateXYZ');join=nodes.new('ShaderNodeCombineXYZ')
        links.new(geo.outputs['Position'],split.inputs[0]);links.new(split.outputs['Y'],join.inputs['X']);links.new(split.outputs['X'],join.inputs['Y'])
        boards=nodes.new('ShaderNodeTexBrick');boards.inputs['Scale'].default_value=1;boards.inputs['Brick Width'].default_value=1.25;boards.inputs['Row Height'].default_value=.18
        boards.inputs['Mortar Size'].default_value=.0013;boards.inputs['Mortar Smooth'].default_value=.001;boards.inputs['Color1'].default_value=(1,1,1,1)
        boards.inputs['Color2'].default_value=(.87,.87,.87,1);boards.inputs['Mortar'].default_value=(.15,.15,.15,1);links.new(join.outputs[0],boards.inputs['Vector'])
        original=bsdf.inputs['Base Color'].links[0].from_socket
        tint=nodes.new('ShaderNodeMixRGB');tint.blend_type='MULTIPLY';tint.inputs[0].default_value=1
        links.new(original,tint.inputs[1]);links.new(boards.outputs['Color'],tint.inputs[2]);links.new(tint.outputs[0],bsdf.inputs['Base Color'])
    if id!='warm':
        mat=material('Theme_Sofa',theme['sofa'],.8)
        fresh_surface(mat,'efc79d' if id=='urban' else theme['sofa'],.70 if id=='urban' else .95,'brown_leather' if id=='urban' else 'rough_linen',18 if id=='urban' else 1.3,.12,id!='urban')
        root=bpy.data.objects['Preview_Sofa']
        for obj in root.children_recursive:
            if obj.type=='MESH':
                obj.data.materials.clear();obj.data.materials.append(mat);obj.data.materials.append(bpy.data.materials['装修_dark'])
                for face in obj.data.polygons:
                    if max((obj.matrix_world@obj.data.vertices[i].co).z for i in face.vertices)<.08:face.material_index=1
        chair_mat=material('Theme_Dining_Upholstery','949fa4' if id=='minimal' else '7c533b',.7)
        fresh_surface(chair_mat,'949fa4' if id=='minimal' else '7c533b',.7,'leather_white',1.3,.12,True)
        for group in scene.objects:
            if not str(group.get('id','')).startswith('dining-chair'):continue
            for obj in group.children_recursive:
                if obj.type!='MESH':continue
                if obj.data.users>1:obj.data=obj.data.copy()
                obj.data.materials.append(chair_mat);index=len(obj.data.materials)-1
                for face in obj.data.polygons:
                    if min((obj.matrix_world@obj.data.vertices[i].co).z for i in face.vertices)>.40:face.material_index=index
    for obj in scene.objects:
        if obj.type=='LIGHT' and obj.data.type=='AREA' and obj.name!='South_Window':obj.data.color=theme['light']
    scene.view_settings.exposure=.68 if id!='urban' else .95
    print('THEME_APPLIED',id,flush=True)
