import bpy
from pathlib import Path
root=Path(__file__).resolve().parent
for theme in ['warm','minimal','urban']:
    bpy.ops.wm.open_mainfile(filepath=str(root/'panorama-render/v2'/theme/'scene.blend'))
    floor=bpy.data.objects.get('Floor_Slab')
    print('FLOOR_BINDING',theme,[(slot.material.name,[(n.name,n.image.filepath) for n in slot.material.node_tree.nodes if n.type=='TEX_IMAGE']) for slot in floor.material_slots],flush=True)
    print('FLOOR_MATERIALS',[(m.name,m.users) for m in bpy.data.materials if 'floor' in m.name],flush=True)
