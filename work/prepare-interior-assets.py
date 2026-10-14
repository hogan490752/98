import base64
import concurrent.futures
import io
import json
import urllib.request
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent
ASSETS = ROOT / 'interior-assets'
ASSETS.mkdir(exist_ok=True)
HEADERS = {'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json'}

def download(url):
    request = urllib.request.Request(url, headers=HEADERS)
    return urllib.request.urlopen(request, timeout=45).read()

def data_uri(blob, mime):
    return 'data:' + mime + ';base64,' + base64.b64encode(blob).decode('ascii')

def asset_files(asset):
    return json.loads(download('https://api.polyhaven.com/files/' + asset))

def prepare_model(asset):
    target = ASSETS / (asset + '.json')
    if target.exists():
        return asset
    files = asset_files(asset)['gltf']['1k']['gltf']
    model = json.loads(download(files['url']))
    references = files['include']
    for buffer in model.get('buffers', []):
        buffer['uri'] = data_uri(download(references[buffer['uri']]['url']), 'application/octet-stream')
    for image in model.get('images', []):
        blob = download(references[image['uri']]['url'])
        decoded = Image.open(io.BytesIO(blob))
        has_alpha = decoded.mode == 'RGBA' and decoded.getextrema()[-1][0] < 255
        original = decoded.convert('RGBA' if has_alpha else 'RGB')
        original.thumbnail((768,768))
        packed = io.BytesIO()
        if has_alpha:
            original.save(packed, format='PNG', optimize=True)
        else:
            original.save(packed, format='JPEG', quality=84)
        image['uri'] = data_uri(packed.getvalue(), 'image/png' if has_alpha else 'image/jpeg')
    target.write_text(json.dumps(model, separators=(',',':')), encoding='utf-8')
    return asset

def prepare_texture(asset):
    target = ASSETS / (asset + '.json')
    if target.exists() and all(role in json.loads(target.read_text(encoding='utf-8')) for role in ['diff','nor_gl','rough']):
        return asset
    files = asset_files(asset)
    maps = {}
    aliases = {'diff':['diff','Diffuse'],'nor_gl':['nor_gl'],'rough':['rough','Rough']}
    for role in ['diff','nor_gl','rough']:
        key = next((name for name in aliases[role] if name in files), role)
        formats = files.get(key, {}).get('1k', {})
        if not formats:
            continue
        spec = formats.get('jpg') or formats.get('png')
        if spec is None:
            continue
        blob = download(spec['url'])
        original = Image.open(io.BytesIO(blob)).convert('RGB')
        original.thumbnail((768,768))
        packed = io.BytesIO()
        original.save(packed, format='JPEG', quality=86)
        maps[role] = data_uri(packed.getvalue(), 'image/jpeg')
    target.write_text(json.dumps(maps,separators=(',',':')),encoding='utf-8')
    return asset

jobs = [(prepare_model, asset) for asset in ['modern_arm_chair_01','dining_chair_02','potted_plant_01','modern_coffee_table_01']] + \
       [(prepare_texture, asset) for asset in ['wood_floor','marble_01','rough_linen']]
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
    futures = [pool.submit(fn, asset) for fn,asset in jobs]
    for future in concurrent.futures.as_completed(futures):
        print(future.result(), flush=True)

licenses = {'provider':'Poly Haven','license':'CC0',
            'licenseUrl':'https://polyhaven.com/license',
            'assets':[{'id':asset,'url':'https://polyhaven.com/a/'+asset} for _,asset in jobs]}
(ASSETS/'licenses.json').write_text(json.dumps(licenses,indent=2),encoding='utf-8')
