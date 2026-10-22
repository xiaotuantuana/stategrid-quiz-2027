"""Offline Windows shell; quiz content and browser edition remain unchanged."""
import argparse
import ctypes
import datetime
import json
import os
import sys
import traceback
from pathlib import Path

from PySide6.QtCore import QTimer, QUrl
from PySide6.QtGui import QAction, QDesktopServices, QIcon, QKeySequence
from PySide6.QtWidgets import QApplication, QFileDialog, QMainWindow, QMessageBox, QToolBar
from PySide6.QtWebEngineCore import QWebEnginePage, QWebEngineProfile, QWebEngineSettings
from PySide6.QtWebEngineWidgets import QWebEngineView

TITLE = '国网题库 2027'
VERSION = '2027.1.1-desktop.1'
EXPORT_JS = "JSON.stringify({schema:2,edition:DATA.version,exported:new Date().toISOString(),state},null,2)"


def navigation_target(scheme):
    return 'external' if scheme in ('http', 'https') else 'local' if scheme in ('file', 'about', 'blob', 'data') else 'block'


def write_backup(root, text):
    value = json.loads(text)
    if not isinstance(value, dict) or value.get('schema') != 2 or not isinstance(value.get('state'), dict):
        raise ValueError('Invalid progress backup')
    folder = root / 'backups'
    folder.mkdir(parents=True, exist_ok=True)
    for filename in ('latest.json', datetime.date.today().isoformat() + '.json'):
        target = folder / filename
        temporary = target.with_suffix('.tmp')
        temporary.write_text(text, encoding='utf-8')
        temporary.replace(target)


class QuizPage(QWebEnginePage):
    def acceptNavigationRequest(self, url, kind, main_frame):
        target = navigation_target(url.scheme())
        if target == 'external':
            QDesktopServices.openUrl(url)
        return target == 'local'


class MainWindow(QMainWindow):
    def __init__(self, root, assets):
        super().__init__()
        self.root, self.assets = root, assets
        self.ready = False
        self.closing = False
        self.allow_close = False
        self.setWindowTitle(TITLE + ' · 离线桌面版')
        self.setWindowIcon(QIcon(str(assets / 'app.ico')))
        self.resize(1180, 840)
        self.setMinimumSize(760, 580)
        self.profile = QWebEngineProfile('StateGrid2027', self)
        self.profile.setPersistentStoragePath(str(root / 'profile'))
        self.profile.setCachePath(str(root / 'cache'))
        self.profile.setHttpCacheType(QWebEngineProfile.HttpCacheType.MemoryHttpCache)
        self.profile.downloadRequested.connect(self.download)
        self.web = QWebEngineView(self)
        self.page = QuizPage(self.profile, self.web)
        self.page.newWindowRequested.connect(self.open_source)
        self.web.setPage(self.page)
        self.web.settings().setAttribute(QWebEngineSettings.WebAttribute.LocalStorageEnabled, True)
        self.web.settings().setAttribute(QWebEngineSettings.WebAttribute.LocalContentCanAccessRemoteUrls, False)
        self.setCentralWidget(self.web)
        self.web.loadFinished.connect(self.loaded)
        self.make_menus()
        self.statusBar().showMessage('正在载入 5,280 道离线练习题…')
        self.timer = QTimer(self)
        self.timer.timeout.connect(self.auto_backup)
        self.timer.start(60000)
        self.home()

    def action(self, parent, text, callback, shortcut=None):
        action = QAction(text, self)
        action.triggered.connect(lambda checked=False: callback())
        if shortcut:
            action.setShortcut(QKeySequence(shortcut))
        parent.addAction(action)
        return action

    def make_menus(self):
        file = self.menuBar().addMenu('记录(&F)')
        self.action(file, '导出学习记录…', self.export, 'Ctrl+S')
        self.action(file, '导入学习记录…', self.import_backup, 'Ctrl+O')
        self.action(file, '打开自动备份文件夹', lambda: QDesktopServices.openUrl(QUrl.fromLocalFile(str(self.root / 'backups'))))
        file.addSeparator()
        self.action(file, '退出', self.close, 'Alt+F4')
        toolbar = QToolBar('常用功能', self)
        toolbar.setMovable(False)
        self.addToolBar(toolbar)
        for name, view in [('学习首页', 'home'), ('考纲练习', 'practice'), ('练习卷', 'exam'), ('错题本', 'wrong'), ('收藏', 'fav'), ('搜索', 'search')]:
            self.action(toolbar, name, lambda v=view: self.go(v))
        toolbar.addSeparator()
        self.action(toolbar, '导出记录', self.export)
        view = self.menuBar().addMenu('显示(&V)')
        self.action(view, '放大字号', lambda: self.zoom(0.1), 'Ctrl+=')
        self.action(view, '缩小字号', lambda: self.zoom(-0.1), 'Ctrl+-')
        self.action(view, '恢复默认字号', lambda: self.web.setZoomFactor(1), 'Ctrl+0')
        self.action(view, '全屏 / 退出全屏', lambda: self.showNormal() if self.isFullScreen() else self.showFullScreen(), 'F11')
        help_menu = self.menuBar().addMenu('帮助(&H)')
        self.action(help_menu, '使用说明', self.help)
        self.action(help_menu, '关于 / 开源许可', lambda: QMessageBox.information(self, '关于', TITLE + '\n' + VERSION + '\n5,280 条练习，含已标注的参数变式。\n不代表 5,280 个独立题型或国网历年真题。\n\n课程题许可见题目来源。桌面组件采用 Qt / PySide6 LGPL v3。\n许可文件与源码位于软件文件夹及项目 desktop 目录。'))

    def zoom(self, delta):
        self.web.setZoomFactor(max(0.7, min(1.8, self.web.zoomFactor() + delta)))

    def home(self):
        self.web.load(QUrl.fromLocalFile(str(self.assets / 'index.html')))

    def go(self, view):
        if self.web.url().fileName() != 'index.html':
            def after(ok):
                self.web.loadFinished.disconnect(after)
                if ok:
                    self.page.runJavaScript('go(' + json.dumps(view) + ')')
            self.web.loadFinished.connect(after)
            self.home()
        elif self.ready:
            self.page.runJavaScript('go(' + json.dumps(view) + ')')

    def loaded(self, ok):
        self.ready = ok and self.web.url().fileName() == 'index.html'
        self.statusBar().showMessage('离线桌面版 · 5,280 题 · 记录自动保存在本机 · Ctrl+S 导出备份' if ok else '载入失败，请检查软件文件夹是否完整')

    def open_source(self, request):
        if request.requestedUrl().scheme() in ('http', 'https'):
            QDesktopServices.openUrl(request.requestedUrl())

    def download(self, request):
        path, _ = QFileDialog.getSaveFileName(self, '保存导出的文件', str(Path.home() / 'Documents' / request.suggestedFileName()), 'JSON (*.json);;所有文件 (*)')
        if path:
            request.setDownloadDirectory(str(Path(path).parent))
            request.setDownloadFileName(Path(path).name)
            request.accept()
        else:
            request.cancel()

    def on_quiz(self, callback):
        if not self.ready:
            QMessageBox.information(self, TITLE, '请先点击“学习首页”，载入题库后再操作。')
            return
        callback()

    def export(self):
        def choose():
            path, _ = QFileDialog.getSaveFileName(self, '导出学习记录', str(Path.home() / 'Documents' / '国网2027-做题记录.json'), 'JSON (*.json)')
            if path:
                self.page.runJavaScript(EXPORT_JS, lambda text: self.save_export(path, text))
        self.on_quiz(choose)

    def save_export(self, path, text):
        try:
            json.loads(text)
            Path(path).write_text(text, encoding='utf-8')
            self.statusBar().showMessage('已导出到 ' + path, 10000)
        except Exception as error:
            QMessageBox.warning(self, '导出失败', str(error))

    def import_backup(self):
        def choose():
            path, _ = QFileDialog.getOpenFileName(self, '导入网页版或桌面版学习记录', '', 'JSON (*.json)')
            if not path:
                return
            try:
                if Path(path).stat().st_size > 10*1024*1024:
                    raise ValueError('备份文件超过10MB')
                text = Path(path).read_text('utf-8-sig')
                payload = json.loads(text)
            except Exception as error:
                QMessageBox.warning(self, '无法读取备份', str(error))
                return
            if QMessageBox.question(self, '导入学习记录', '将替换桌面版当前学习记录。继续吗？') != QMessageBox.StandardButton.Yes:
                return
            self.auto_backup()
            script = "(()=>{try{const imported=validImported(" + json.dumps(payload, ensure_ascii=True) + ");state=imported;save();go('home');return 'OK';}catch(e){return e.message;}})()"
            self.page.runJavaScript(script, lambda result: self.statusBar().showMessage('导入成功', 10000) if result == 'OK' else QMessageBox.warning(self, '导入失败', str(result)))
        self.on_quiz(choose)

    def auto_backup(self, done=None):
        if not self.ready:
            if done:
                done()
            return
        def persist(text):
            try:
                write_backup(self.root, text)
            except Exception as error:
                self.statusBar().showMessage('自动备份失败：' + str(error))
            if done:
                done()
        self.page.runJavaScript(EXPORT_JS, persist)

    def help(self):
        QMessageBox.information(self, '使用说明', '直接使用上方按钮进入练习、错题本与收藏。\nCtrl+加号/减号调整字号，F11切换全屏。\n学习记录保存在：\n' + str(self.root) + '\n\n每分钟及退出时自动备份。可在“记录”菜单打开备份文件夹。\n网页旧记录：先在网页版“来源 / 备份”导出，再在本软件按 Ctrl+O 导入。\n来源链接会在系统浏览器中打开，练习本身无需联网。')

    def closeEvent(self, event):
        if self.allow_close:
            event.accept()
            return
        event.ignore()
        if not self.closing:
            self.closing = True
            self.timer.stop()
            def finish():
                self.allow_close = True
                self.close()
            self.auto_backup(finish)
            QTimer.singleShot(3000, finish)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--data-dir', type=Path)
    parser.add_argument('--self-test', choices=['write', 'read'])
    parser.add_argument('--test-output', type=Path)
    args = parser.parse_args()
    root = args.data_dir or Path(os.environ.get('LOCALAPPDATA', str(Path.home()))) / 'StateGridQuiz2027'
    root.mkdir(parents=True, exist_ok=True)
    assets = Path(getattr(sys, '_MEIPASS', Path(__file__).parent)) / 'assets'
    if sys.platform == 'win32':
        ctypes.windll.shell32.SetCurrentProcessExplicitAppUserModelID('StateGridQuiz2027.Desktop')
    app = QApplication(sys.argv[:1])
    app.setApplicationName(TITLE)
    app.setOrganizationName('StateGridQuiz2027')
    app.setStyle('Fusion')
    window = MainWindow(root, assets)
    window.show()
    if args.self_test:
        from smoke_test import install_smoke_test
        install_smoke_test(app, window, args)
    return app.exec()


if __name__ == '__main__':
    try:
        sys.exit(main())
    except Exception:
        log = Path(os.environ.get('LOCALAPPDATA', str(Path.home()))) / 'StateGridQuiz2027-startup-error.txt'
        log.write_text(traceback.format_exc(), encoding='utf-8')
        if QApplication.instance():
            QMessageBox.critical(None, '国网题库启动失败', '错误记录：' + str(log))
        raise
