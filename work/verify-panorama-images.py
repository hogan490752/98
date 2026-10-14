from pathlib import Path
from PIL import Image
import hashlib

root=Path(__file__).resolve().parent/'panorama-render/v2'
hashes={}
for theme in ['warm','minimal','urban']:
    images=[p for p in (root/theme).glob('*.png') if not p.name.endswith('-preview.png')]
    assert len(images)==11,(theme,len(images))
    for path in images:
        with Image.open(path) as image:
            assert image.size==(4096,2048),path
            image.verify()
        digest=hashlib.sha256(path.read_bytes()).hexdigest()
        assert digest not in hashes,path
        hashes[digest]=path
print('VALID_4K_UNIQUE_PANORAMAS',len(hashes))
