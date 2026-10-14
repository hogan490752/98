"""用Blender的OpenImageDenoise处理线性HDR光照图，保留色彩和光照动态范围。"""
import bpy
import base64
import json
from pathlib import Path

root=Path(__file__).resolve().parent/'realism-assets'
bpy.ops.wm.open_mainfile(filepath=str(root/'living-bake.blend'))
scene=bpy.context.scene;scene.use_nodes=True;nodes=scene.node_tree.nodes;nodes.clear()
image=nodes.new('CompositorNodeImage');image.image=bpy.data.images.load(str(root/'indirect.hdr'),check_existing=False)
denoise=nodes.new('CompositorNodeDenoise');denoise.prefilter='ACCURATE'
output=nodes.new('CompositorNodeOutputFile');output.base_path=str(root)
output.file_slots[0].path='indirect-denoised-';output.format.file_format='HDR';output.format.color_mode='RGB'
scene.node_tree.links.new(image.outputs['Image'],denoise.inputs['Image'])
scene.node_tree.links.new(denoise.outputs['Image'],output.inputs[0])
scene.render.resolution_x=8;scene.render.resolution_y=8;scene.cycles.samples=1
bpy.ops.render.render()
path=root/'indirect-denoised-0001.hdr'
assert path.exists(),'没有生成降噪光照图'
(root/'indirect.json').write_text(json.dumps({'hdr':base64.b64encode(path.read_bytes()).decode()}),encoding='utf-8')
print('DENOISED_LIGHTMAP_READY',flush=True)
