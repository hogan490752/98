"""发布自包含网页和说明；全景源场景及独立产品资产只保留在本机。"""
from pathlib import Path
import shutil
import sys
import zipfile

root=Path(__file__).resolve().parent.parent/'outputs'
web='--web' in sys.argv
files=[
    'apartment-panorama.html','apartment-viewer.html',
    '全景看房说明.md','使用说明.md','素材来源与许可.md','写实升级方案.md',
    '空间面积明细.md','area-breakdown.json','model-dimensions.json',
    '暖木现代-初始方案.json','清爽极简-初始方案.json','都市深色-初始方案.json',
    '暖木现代-装修模型.glb','apartment-shell.glb',
    '全景-warm-客厅.png','全景-minimal-客厅.png','全景-urban-客厅.png',
    '全景-urban-餐厅.png','全景-细节-kitchen.png','全景-细节-master.png',
    '全景-细节-bath-west.png','全景-细节-bath-east.png','全景看房-手机.png',
]
target=root/'我的家-全景看房.zip'
if web:
    site=root/'website'
    assert (site/'apartment-panorama.html').is_file(),'请先运行 node work/package-panorama.mjs --web'
    shutil.copyfile(Path(__file__).resolve().parent/'website-index.html',site/'index.html')
    for name in ['apartment-viewer.html','素材来源与许可.md']:
        shutil.copyfile(root/name,site/name)
    # 网站构建和ZIP共用同一部署说明，避免两份文字逐渐不一致。
    shutil.copyfile(Path(__file__).resolve().parent/'website-deploy.txt',site/'部署说明.txt')
    files=['index.html','apartment-panorama.html','apartment-viewer.html','部署说明.txt','素材来源与许可.md']
    images=sorted((site/'panoramas').glob('*/*.jpg'))
    assert len(images)==33,len(images)
    files.extend(path.relative_to(site).as_posix() for path in images)
    root=site
    target=site.parent/'我的家-服务器发布包.zip'
    for name in ['index.html','apartment-panorama.html','apartment-viewer.html']:
        assert '127.0.0.1:8841' not in (root/name).read_text(encoding='utf-8'),name
for name in files:
    assert (root/name).is_file(),name
temporary=target.with_suffix('.tmp.zip')
with zipfile.ZipFile(temporary,'w',zipfile.ZIP_DEFLATED,compresslevel=5) as archive:
    for name in files:
        archive.write(root/name,arcname=name)
with zipfile.ZipFile(temporary) as archive:
    assert archive.testzip() is None
    assert archive.getinfo('apartment-panorama.html').file_size==(root/'apartment-panorama.html').stat().st_size
    assert not any(name.endswith('.blend') or 'product-sofa' in name for name in archive.namelist())
temporary.replace(target)
print('DELIVERY_ZIP_VALID',len(files),target.stat().st_size)
