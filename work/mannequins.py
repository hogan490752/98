"""米制成人比例假人：固定身高和骨段长度，只按用途改变姿势。"""
import bpy,json,math
from pathlib import Path
from mathutils import Vector,Matrix
from panorama_detail import material,mesh_object,cube

ROOT=Path(__file__).resolve().parent
RATIOS={'thigh':.244,'shin':.242,'upper_arm':.186,'forearm':.146,'shoulder_to_hip':.290,'head_height':.142}

def ellipsoid(name,center,radii,mat,parent,axis=None):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24,ring_count=16,radius=1)
    obj=bpy.context.object;obj.name='Mannequin_'+name;obj.parent=parent;obj.location=center;obj.scale=radii
    if axis is not None:obj.rotation_euler=Vector(axis).to_track_quat('Z','Y').to_euler()
    obj.data.materials.append(mat)
    for face in obj.data.polygons:face.use_smooth=True
    return obj

def segment(name,a,b,radius,mat,parent):
    a,b=Vector(a),Vector(b)
    return ellipsoid(name,(a+b)/2,(radius,radius,(b-a).length/2+radius*.4),mat,parent,b-a)

def pose(id,height,kind,seat=0,floor=0):
    root=bpy.data.objects.new('Mannequin_'+id,None);bpy.context.collection.objects.link(root)
    root['mannequin_id']=id;root['height_m']=height;root['pose']=kind
    h=height;mat=bpy.data.materials.get('Mannequin_170' if h==1.7 else 'Mannequin_160')
    hip=floor+.530*h if kind!='seated' else seat+.078*h
    joints={};lengths={}
    ellipsoid('Pelvis',(0,0,0),(.092*h,.060*h,.078*h),mat,root)
    # 环形截面保留腰、胸和肩的成人比例，不对坐姿或卧姿压缩躯干。
    verts=[];faces=[];n=32
    for z,rx,ry in [(0,.085,.052),(.08,.076,.049),(.18,.102,.057),(.26,.112,.051),(.30,.092,.044)]:
        for i in range(n):a=i*math.tau/n;verts.append((rx*h*math.cos(a),ry*h*math.sin(a),z*h))
    for j in range(4):
        for i in range(n):a=j*n+i;b=j*n+(i+1)%n;faces.append((a,b,b+n,a+n))
    faces.extend([tuple(range(n-1,-1,-1)),tuple(4*n+i for i in range(n))])
    torso=mesh_object('Mannequin_Torso',verts,faces,mat,root)
    mod=torso.modifiers.new('Torso_Surface','SUBSURF');mod.levels=1
    head_forward=-.05*h if kind=='lying' else 0
    segment('Neck',(0,0,.300*h),(0,head_forward,.353*h),.027*h,mat,root)
    ellipsoid('Head',(0,head_forward,.399*h),(.049*h,.055*h,.071*h),mat,root)
    ellipsoid('Nose',(0,head_forward-.054*h,.392*h),(.011*h,.015*h,.017*h),mat,root)
    for side in [-1,1]:
        hip_joint=Vector((side*.055*h,0,0))
        if kind=='seated':
            knee_z=floor+.044*h+.242*h*math.cos(.12)-hip
            knee_x=side*.035*h
            reach=math.sqrt((.244*h)**2-knee_z**2-(knee_x-hip_joint.x)**2)
            knee=Vector((knee_x,-reach,knee_z))
            ankle=knee+Vector((0,.242*h*math.sin(.12),-.242*h*math.cos(.12)))
        else:
            knee=hip_joint+Vector((0,0,-.244*h));ankle=knee+Vector((0,0,-.242*h))
        shoulder=Vector((side*.119*h,0,.290*h))
        if kind=='seated':
            # 双骨段解析求解，让手落在大腿中部，同时保持上臂与前臂长度。
            wrist=Vector((side*.058*h,knee.y*.52+.042*h,knee.z*.52+.066*h))
            direction=(wrist-shoulder).normalized();distance=(wrist-shoulder).length
            upper,lower=.186*h,.146*h
            along=(upper*upper-lower*lower+distance*distance)/(2*distance)
            bend=Vector((side*.35,.7,0));bend=(bend-direction*bend.dot(direction)).normalized()
            elbow=shoulder+direction*along+bend*math.sqrt(upper*upper-along*along)
        else:
            elbow=shoulder+Vector((0,0,-.186*h));wrist=elbow+Vector((0,0,-.146*h))
        for name,a,b,radius in [('Thigh',hip_joint,knee,.051),('Shin',knee,ankle,.033),('Upper_Arm',shoulder,elbow,.030),('Forearm',elbow,wrist,.025)]:
            segment(name+str(side),a,b,radius*h,mat,root);lengths[name+str(side)]=(b-a).length
        for name,p,r in [('Knee',knee,.033),('Ankle',ankle,.023),('Shoulder',shoulder,.032),('Elbow',elbow,.025),('Wrist',wrist,.019)]:
            ellipsoid(name+str(side),p,(r*h,)*3,mat,root)
        foot_y=ankle.y-(.012 if kind=='lying' else .028)*h
        foot_z=(floor+.021*h-hip) if kind=='seated' else -.509*h
        ellipsoid('Foot'+str(side),(ankle.x,foot_y,foot_z),(.031*h,.071*h,.021*h),mat,root)
        hand_center=wrist+Vector((0,-.042*h if kind=='seated' else 0,-.042*h if kind!='seated' else 0))
        ellipsoid('Hand'+str(side),hand_center,(.026*h,.016*h if kind!='seated' else .050*h,.050*h if kind!='seated' else .016*h),mat,root)
        joints[str(side)]={name:list(p) for name,p in [('hip',hip_joint),('knee',knee),('ankle',ankle),('shoulder',shoulder),('elbow',elbow),('wrist',wrist)]}
    root['bone_lengths']=json.dumps(lengths);root['joint_positions']=json.dumps(joints)
    return root,hip

def world_bounds(root):
    bpy.context.view_layer.update()
    p=[o.matrix_world@Vector(c) for o in root.children_recursive if o.type=='MESH' for c in o.bound_box]
    return [[min(v[i] for v in p) for i in range(3)],[max(v[i] for v in p) for i in range(3)]]

def ray_height(x,y,start,distance):
    ok,p,*_=bpy.context.scene.ray_cast(bpy.context.evaluated_depsgraph_get(),Vector((x,y,start)),Vector((0,0,-1)),distance=distance)
    assert ok,'找不到假人的支撑面'
    return p.z

def rigid_frame(obj):
    # 沙发有非均匀缩放；人体只继承平移与旋转，避免身宽/身长被家具缩放。
    return Matrix.Translation(obj.matrix_world.translation)@obj.matrix_world.to_quaternion().to_matrix().to_4x4()

def add_mannequins():
    material('Mannequin_170','78999f',.65);material('Mannequin_160','c4b393',.65)
    checks={}
    for height in [1.7,1.6]:
        ref,hip=pose('reference',height,'standing');ref.location.z=hip
        low,high=world_bounds(ref);checks[str(height)]=high[2]-low[2]
        assert abs(checks[str(height)]-height)<.00001,'站立身高必须与输入一致'
        for o in reversed([ref]+list(ref.children_recursive)):bpy.data.objects.remove(o,do_unlink=True)
    rows=[]
    def seated(id,height,room,furniture,offset,seat_override=None):
        frame=rigid_frame(furniture);p=frame@Vector((*offset,0))
        seat=ray_height(p.x,p.y,.65,.65) if seat_override is None else seat_override
        # 脚底支撑以实际地面或地毯为准，肢段仍保持同一长度。
        forward=frame.to_3x3()@Vector((0,-.35,0));floor=ray_height(p.x+forward.x,p.y+forward.y,.10,.20)
        person,hip=pose(id,height,'seated',seat,floor);person.matrix_world=frame@Matrix.Translation(Vector((*offset,hip)))
        person['support_z']=seat;person['support_meshes']=json.dumps([o.name for o in furniture.children_recursive if o.type=='MESH'])
        person['room']=room;rows.append(person)
    chairs=sorted([o for o in bpy.context.scene.objects if str(o.get('id','')).startswith('dining-chair')],key=lambda o:o.get('id'))
    for i,chair in enumerate(chairs):seated('dining-'+str(i+1),1.7 if i%2==0 else 1.6,'dining',chair,(0,-.055))
    sofa=bpy.data.objects['Preview_Sofa']
    for i,height in enumerate([1.7,1.6]):seated('sofa-'+str(i+1),height,'living',sofa,((i*2-1)*.48,-.19))
    beds=sorted([o for o in bpy.context.scene.objects if o.name.startswith('Detail_Bed')],key=lambda o:o.name)
    for bed,room,depth,heights in zip(beds,['master','bedroom-south','bedroom-north'],[2.1,1.9,1.9],[[1.7,1.6],[1.7],[1.6]]):
        for i,height in enumerate(heights):
            x=(i*2-1)*.385 if len(heights)==2 else 0
            cy=depth/2-.15-.470*height
            frame=rigid_frame(bed);p=frame@Vector((x,cy,0));surface=ray_height(p.x,p.y,.80,.50)
            person,_=pose(room+'-'+str(i+1),height,'lying');person['room']=room
            person.matrix_world=frame@Matrix.Translation(Vector((x,cy,surface+.061*height)))@Matrix.Rotation(-math.pi/2,4,'X');rows.append(person)
    toilets=sorted([o for o in bpy.context.scene.objects if o.name.startswith('Detail_Toilet')],key=lambda o:o.name)
    for i,toilet in enumerate(toilets):
        for o in toilet.children:
            if o.name.startswith('Seat_Lid'):o.hide_render=True
        cube('Raised_Toilet_Lid',(.325,.018,.46),(0,.13,.714),bpy.data.materials['Detail_Ceramic'],toilet,.018)
        seated('toilet-'+str(i+1),1.7 if i==0 else 1.6,'bath-west' if i==0 else 'bath-east',toilet,(0,-.055),.464)
    for i,(height,p) in enumerate([(1.7,(2.80,-3.58)),(1.6,(3.00,-4.23))]):
        floor=ray_height(*p,.10,.20);person,hip=pose('kitchen-'+str(i+1),height,'standing',floor=floor)
        person.location=(*p,hip);person.rotation_euler.z=math.pi/2;person['room']='kitchen';rows.append(person)
    bpy.context.view_layer.update()
    report={'standingHeights':checks,'ratios':RATIOS,'people':[]}
    for o in rows:
        report['people'].append({'id':o['mannequin_id'],'room':o['room'],'height':o['height_m'],'pose':o['pose'],'position':list(o.location),'bounds':world_bounds(o),'boneLengths':json.loads(o['bone_lengths'])})
    assert len(rows)==14
    (ROOT/'mannequin-layout.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    print('MANNEQUINS_CREATED',len(rows),checks,flush=True)
    return report
