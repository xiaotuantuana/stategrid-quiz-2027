import json
import tempfile
import unittest
from pathlib import Path

from desktop_app import write_backup, navigation_target


class DesktopTests(unittest.TestCase):
    def test_atomic_backup_preserves_unicode_and_daily_copy(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            payload = {'schema': 2, 'state': {'fav': {'中文': True}}}
            write_backup(root, json.dumps(payload, ensure_ascii=False))
            self.assertEqual(json.loads((root/'backups'/'latest.json').read_text('utf-8')), payload)
            self.assertEqual(len(list((root/'backups').glob('20*.json'))), 1)

    def test_invalid_backup_does_not_replace_last_good_file(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            write_backup(root, '{"schema":2,"state":{}}')
            with self.assertRaises(ValueError):
                write_backup(root, 'null')
            self.assertEqual(json.loads((root/'backups'/'latest.json').read_text('utf-8'))['schema'], 2)

    def test_external_navigation_only_opens_web_sources(self):
        self.assertEqual(navigation_target('https'), 'external')
        self.assertEqual(navigation_target('file'), 'local')
        self.assertEqual(navigation_target('javascript'), 'block')
        self.assertEqual(navigation_target('mailto'), 'block')


if __name__ == '__main__':
    unittest.main()
