"""在站点子目录中检查解压后的发布包，避免仅验证打包源目录。"""
from pathlib import Path
import zipfile

root=Path(__file__).resolve().parent.parent
target=root/'outputs/publish-check/house'
with zipfile.ZipFile(root/'outputs/我的家-服务器发布包.zip') as archive:
    assert archive.testzip() is None
    assert len(archive.namelist())==38
    # 文件名均由本项目生成，仍校验归一化路径后再解压。
    for name in archive.namelist():
        assert (target/name).resolve().is_relative_to(target.resolve()),name
    archive.extractall(target)
assert len(list((target/'panoramas').glob('*/*.jpg')))==33
assert (target/'index.html').is_file()
assert (target/'apartment-panorama.html').stat().st_size<1_000_000
print('EXTRACTED_WEBSITE_VALID',target)
