"""End-to-end checks inside the real native application, using a test-only profile."""
import json
from pathlib import Path
from PySide6.QtCore import QTimer
from PySide6.QtWidgets import QFileDialog, QMessageBox


def install_smoke_test(app, window, args):
    output = args.test_output
    output.mkdir(parents=True, exist_ok=True)
    checks = []
    timers = []
    def finish(ok, detail=''):
        (output / (args.self_test + '.json')).write_text(json.dumps({'passed': ok, 'checks': checks, 'detail': detail}, ensure_ascii=False, indent=2), 'utf-8')
        window.auto_backup(lambda: app.exit(0 if ok else 1))
    def check(name, value):
        checks.append({'check': name, 'passed': bool(value)})
        if not value:
            finish(False, name)
            return False
        return True
    def js(code, callback):
        window.page.runJavaScript('JSON.stringify(' + code + ')', lambda raw: callback(json.loads(raw) if raw else None))
    def exported():
        path = output / 'native-export.json'
        try:
            value = json.loads(path.read_text('utf-8'))
            if not check('native export keeps schema and progress', value['schema'] == 2 and bool(value['state']['fav'])):
                return
            if args.self_test == 'read':
                value['edition'] = '2027.1.0'
                imported = output / 'old-version-import.json'
                imported.write_text(json.dumps(value), 'utf-8')
                QFileDialog.getOpenFileName = staticmethod(lambda *a, **k: (str(imported), 'JSON'))
                QMessageBox.question = staticmethod(lambda *a, **k: QMessageBox.StandardButton.Yes)
                window.import_backup()
                QTimer.singleShot(1000, lambda: js("({count:ALL.length,fav:Object.keys(state.fav).length})", lambda r: finish(check('native import accepts previous edition', r['count'] == 5280 and r['fav'] == 1))))
            else:
                window.grab().save(str(output / 'desktop-window.png'))
                finish(True)
        except Exception as error:
            finish(False, str(error))
    def export():
        QFileDialog.getSaveFileName = staticmethod(lambda *a, **k: (str(output / 'native-export.json'), 'JSON'))
        window.export()
        QTimer.singleShot(800, exported)
    def ready():
        if not window.ready:
            QTimer.singleShot(150, ready)
            return
        if args.self_test == 'write':
            code = "(()=>{const q=ALL[0];state.fav[q.id]=true;state.done[q.id]={correct:false,answers:[],at:new Date().toISOString()};save();go('fav');return {count:ALL.length,stem:document.querySelector('.stem')?.textContent,fav:Object.keys(state.fav).length};})()"
        else:
            code = "(()=>{go('wrong');return {count:ALL.length,stem:document.querySelector('.stem')?.textContent,fav:Object.keys(state.fav).length,done:Object.keys(state.done).length};})()"
        def result(value):
            if not check('native engine loads all 5280 questions', value and value.get('count') == 5280):
                return
            if not check('question renders in native window', bool(value.get('stem'))):
                return
            if not check('favorite persists' if args.self_test == 'read' else 'favorite saved', value.get('fav') == 1):
                return
            if args.self_test == 'read' and not check('wrong answer persists across process restart', value.get('done') == 1):
                return
            export()
        js(code, result)
    QTimer.singleShot(100, ready)
    watchdog = QTimer(window)
    watchdog.setSingleShot(True)
    watchdog.timeout.connect(lambda: finish(False, '45 second timeout'))
    watchdog.start(45000)
    timers.append(watchdog)
