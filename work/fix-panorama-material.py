"""检查离线渲染的湿区薄饰面层，保留完整结构墙并生成对照小图。"""
import bpy
import math
from pathlib import Path
from mathutils import Vector
root=Path(__file__).resolve().parent
bpy.ops.wm.open_mainfile(filepath=str(root/'panorama-render/furnished-panorama.blend'))
scene=bpy.context.scene;camera=scene.camera;camera.location=(8.16,-6.57,1.55)
for obj in scene.objects:
    if obj.type=='MESH' and any(slot.material and slot.material.name=='装修_wetWall' for slot in obj.material_slots):obj.hide_render=True
camera.rotation_euler=(Vector((8.81,-5.64,1.15))-camera.location).to_track_quat('-Z','Y').to_euler()
camera.data.type='PERSP';camera.data.sensor_fit='VERTICAL';camera.data.sensor_height=24;camera.data.lens=24/(2*math.tan(math.radians(35)))
scene.render.resolution_x=800;scene.render.resolution_y=520;scene.render.resolution_percentage=100;scene.cycles.samples=16
scene.render.filepath=str(root/'panorama-render/bath-material-preview.png')
bpy.ops.render.render(write_still=True)
bpy.ops.wm.save_as_mainfile(filepath=str(root/'panorama-render/furnished-panorama-fixed.blend'))
