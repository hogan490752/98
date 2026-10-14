"""准备固定点位渲染资产，模型仅作为本户型个人装修预览参考。"""
import json
import re
import struct
import urllib.request
from pathlib import Path

ROOT=Path(__file__).resolve().parent
OUT=ROOT/'realism-assets'
text=(ROOT/'ikea-product.html').read_text(encoding='utf-8')
urls=re.findall(r'https://[^"<> ]+simple.glb\?cn=pip',text)
url=urls[0]
target=OUT/'product-sofa.glb'
if not target.exists():
    request=urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0'})
    target.write_bytes(urllib.request.urlopen(request,timeout=60).read())
(OUT/'product-sofa-source.json').write_text(json.dumps({
    'page':'https://www.ikea.com/us/en/p/kivik-sofa-tibbleby-beige-gray-s39440593/',
    'modelUrl':url,'usage':'personal apartment planning render reference'
},indent=2),encoding='utf-8')
blob=target.read_bytes();length=struct.unpack_from('<I',blob,12)[0];data=json.loads(blob[20:20+length])
print('SOFA_ASSET',len(blob),'meshes',len(data['meshes']),flush=True)

# 表面素材保留2K细节，在Blender内按真实尺度使用。
for asset in ['leather_white','brown_leather','black_walnut_veneer_01','rough_linen','marble_01','wood_floor']:
    folder=OUT/'surfaces'/asset;folder.mkdir(parents=True,exist_ok=True)
    request=urllib.request.Request('https://api.polyhaven.com/files/'+asset,headers={'User-Agent':'Mozilla/5.0','Accept':'application/json'})
    files=json.load(urllib.request.urlopen(request,timeout=45))
    for role,aliases in [('diff',['diff','Diffuse']),('nor_gl',['nor_gl']),('rough',['rough','Rough'])]:
        name=next((a for a in aliases if a in files),None)
        if not name:continue
        formats=files[name].get('2k',files[name].get('1k',{}));spec=formats.get('jpg') or formats.get('png')
        target=folder/(role+'.'+spec['url'].split('.')[-1])
        if not target.exists():target.write_bytes(urllib.request.urlopen(urllib.request.Request(spec['url'],headers={'User-Agent':'Mozilla/5.0'}),timeout=60).read())
    print('SURFACE_ASSET',asset,flush=True)
