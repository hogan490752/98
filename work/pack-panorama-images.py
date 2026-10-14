"""将已完成全景转为适合网页内嵌的 JPEG，不修改三维几何。"""
from pathlib import Path
from PIL import Image

folder=Path(__file__).resolve().parent/'panorama-render'
for source in (folder/'v2').rglob('*.png'):
    if source.name.endswith('-preview.png'):continue
    target=source.with_suffix('.jpg')
    if target.exists() and target.stat().st_mtime>=source.stat().st_mtime:continue
    with Image.open(source) as image:
        image.convert('RGB').save(target,quality=95,subsampling=0,optimize=True)
        print(source.stem,image.size,target.stat().st_size)
