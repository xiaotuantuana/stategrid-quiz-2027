"""Prepare a reproducible portable folder. Run with the packaging Python."""
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HERE = ROOT / 'desktop'
ASSETS = HERE / 'assets'
ASSETS.mkdir(exist_ok=True)
for name in ('index.html', '升级报告.html', '本轮联网补充.html', 'LICENSE-web-round2.md'):
    shutil.copy2(ROOT / name, ASSETS / name)
html = (ASSETS / 'index.html').read_text('utf-8')
html = html.replace('做题记录保存在当前浏览器；建议定期到“来源 / 备份”导出。', '桌面版：记录自动保存在本机；可按 Ctrl+S 导出备份，Ctrl+O 导入旧记录。')
html = html.replace('浏览器或文件位置改变可能影响本地记录。', '桌面版记录保存在本机用户目录，网页版记录可导出后导入。')
(ASSETS / 'index.html').write_text(html, 'utf-8')

from PIL import Image, ImageDraw, ImageFont
im = Image.new('RGBA', (256,256), '#143c60')
d = ImageDraw.Draw(im)
d.rounded_rectangle((20,20,236,236),radius=38,fill='#146a77')
d.polygon([(145,40),(67,143),(119,143),(104,217),(193,107),(140,107)], fill='#ffffff')
d.line((57,220,202,220), fill='#9de1c8', width=7)
im.save(ASSETS / 'app.ico', sizes=[(16,16),(32,32),(48,48),(64,64),(128,128),(256,256)])

if '--assets-only' not in sys.argv:
    subprocess.run([sys.executable, '-m', 'PyInstaller', '--noconfirm', '--clean', '--windowed', '--onedir',
        '--name', '国网题库2027', '--icon', str(ASSETS / 'app.ico'),
        '--add-data', str(ASSETS) + ';assets',
        '--distpath', str(ROOT / '软件'), '--workpath', str(HERE / 'build'),
        '--specpath', str(HERE), str(HERE / 'desktop_app.py')], check=True)
    target = ROOT / '软件' / '国网题库2027'
    # Qt 6.11 uses the unversioned Windows ICU ABI. The packager can pick up
    # unrelated ICU 78 libraries from PATH, whose suffixed exports break QtCore.
    # Resolve ICU from Windows 10/11 System32, as the unfrozen application does.
    for name in ('icuuc.dll', 'icudt78.dll'):
        (target / '_internal' / name).unlink(missing_ok=True)
    shutil.copy2(ROOT / 'LICENSE-web-round2.md', target)
    (target / '使用说明.txt').write_text('国网题库2027 · Windows免安装版\n\n双击“国网题库2027.exe”启动，无需Python，可离线练习。\n请保留同目录的_internal文件夹，移动软件时请移动整个文件夹。\n\n记录自动保存在 %LOCALAPPDATA%\\StateGridQuiz2027。\n每分钟及退出时自动备份；在“记录”菜单可打开备份文件夹。\nCtrl+S导出，Ctrl+O导入。网页版记录须先导出，再导入本软件。\nCtrl+加号/减号缩放字号，F11全屏。\n\n题库5280条，含3567条参数变式；不代表同等数量独立题型或国网真题。\n开源与课程许可见LICENSE文件，源代码见项目desktop目录。\n', encoding='utf-8')
    import PySide6
    package = Path(PySide6.__file__).parent
    license_dir = target / 'licenses'
    license_dir.mkdir(exist_ok=True)
    for source in list((package / 'LICENSES').glob('*')) + list((HERE / 'licenses').glob('*')):
        if source.is_file():
            shutil.copy2(source, license_dir / source.name)
    shutil.copytree(HERE, target / 'desktop-source', ignore=shutil.ignore_patterns('build', 'assets', '__pycache__', '*.spec'), dirs_exist_ok=True)
    print('Portable build:', target)
