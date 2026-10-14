import bpy
from pathlib import Path
root=Path(__file__).resolve().parent
bpy.ops.wm.open_mainfile(filepath=str(root/'panorama-render/v2/detailed-base.blend'))
for obj in bpy.context.scene.objects:
    if obj.type=='MESH' and obj.name.startswith('Detail_Duvet'):
        print('DUVET_RANGE',obj.name,min(v.co.z for v in obj.data.vertices),max(v.co.z for v in obj.data.vertices),flush=True)
