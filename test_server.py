import concurrent.futures
import http.client
import json
import os
import tempfile
import threading
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path

from server import connect, make_server


class LinkLabTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory(dir=os.environ.get("LINKLAB_TEST_TMP"))
        cls.db_path = Path(cls.temp.name) / "test.db"
        cls.server = make_server("127.0.0.1", 0, cls.db_path)
        cls.port = cls.server.server_port
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join()
        cls.temp.cleanup()

    def setUp(self):
        with connect(self.db_path) as db:
            db.execute("DELETE FROM visits")
            db.execute("DELETE FROM links")
            db.execute("DELETE FROM projects")
        status, _, body = self.request("POST", "/api/projects", {"name":"Test project"})
        self.assertEqual(status, 201, body)
        self.project_id = json.loads(body)["id"]

    def request(self, method, path, data=None, headers=None):
        conn = http.client.HTTPConnection("127.0.0.1", self.port, timeout=25)
        h = {"Content-Type": "application/json"} if data is not None else {}
        h.update(headers or {})
        conn.request(method, path, json.dumps(data) if data is not None else None, h)
        response = conn.getresponse()
        result = (response.status, dict(response.getheaders()), response.read())
        conn.close()
        return result

    def create(self, **extra):
        code, _, body = self.request("POST", "/api/links", {"url":"https://example.com/path?q=1", "project_id":self.project_id, **extra})
        self.assertEqual(code, 201, body)
        return json.loads(body)["code"]

    def dashboard(self):
        return json.loads(self.request("GET", "/api/dashboard")[2])

    def test_create_redirect_cookie_and_statistics(self):
        code = self.create(title="Портфолио", code="portfolio")
        status, headers, _ = self.request("GET", "/"+code, headers={"User-Agent":"Mozilla/5.0 iPhone Mobile Safari", "Referer":"https://example.org/post?private=1"})
        self.assertEqual(status, 302)
        self.assertEqual(headers["Location"], "https://example.com/path?q=1")
        cookie = headers["Set-Cookie"].split(";")[0]
        self.request("GET", "/"+code, headers={"Cookie":cookie})
        data = self.dashboard()
        self.assertEqual(data["links"][0]["clicks"], 2)
        self.assertEqual(data["unique"], 1)
        self.assertEqual(data["visits"][-1]["device"], "Телефон")
        self.assertEqual(data["visits"][-1]["referrer"], "example.org")
        self.assertNotIn("visitor", data["visits"][0])

    def test_limit_under_concurrent_requests(self):
        code = self.create(max_clicks=10)
        def visit(_):
            return self.request("GET", "/"+code)[0]
        with concurrent.futures.ThreadPoolExecutor(max_workers=16) as pool:
            results = list(pool.map(visit, range(50)))
        self.assertEqual(results.count(302), 10)
        self.assertEqual(results.count(410), 40)
        data = self.dashboard()
        self.assertEqual(data["links"][0]["clicks"], 10)
        self.assertEqual(data["links"][0]["status"], "limit")
        self.assertEqual(len(data["visits"]), 50)

    def test_head_does_not_consume_limit(self):
        code = self.create(max_clicks=1)
        self.assertEqual(self.request("HEAD", "/"+code)[0],302)
        self.assertEqual(self.dashboard()["links"][0]["clicks"],0)
        self.assertEqual(self.request("GET", "/"+code)[0],302)
        self.assertEqual(self.request("GET", "/"+code)[0],410)

    def test_pause_edit_expiry_and_delete(self):
        code = self.create()
        link_id = self.dashboard()["links"][0]["id"]
        endpoint = f"/api/links/{link_id}"
        self.assertEqual(self.request("PATCH", endpoint, {"enabled":False})[0],200)
        self.assertEqual(self.request("GET", "/"+code)[0],410)
        self.request("PATCH", endpoint, {"enabled":True})
        self.request("PATCH", endpoint, {"url":"https://example.org/new", "title":"Новое", "max_clicks":5})
        status, headers, _ = self.request("GET", "/"+code)
        self.assertEqual(status,302)
        self.assertEqual(headers["Location"],"https://example.org/new")
        with connect(self.db_path) as db:
            db.execute("UPDATE links SET expires_at=?", ((datetime.now(timezone.utc)-timedelta(seconds=5)).isoformat(timespec="seconds"),))
        self.assertEqual(self.request("GET", "/"+code)[0],410)
        self.assertEqual(self.dashboard()["links"][0]["status"],"expired")
        self.assertEqual(self.request("DELETE", endpoint, {})[0],200)
        self.assertEqual(self.request("GET", "/"+code)[0],404)
        self.assertEqual(self.dashboard()["visits"],[])

    def test_validation_and_origin_protection(self):
        for url in ["javascript:alert(1)","file:///etc/passwd","https://user:pass@example.com", "https://example.com/\nheader", f"http://localhost:{self.port}/loop"]:
            self.assertEqual(self.request("POST", "/api/links", {"url":url})[0],400,url)
        for limit in [0,-1,1.5,True,"5"]:
            self.assertEqual(self.request("POST", "/api/links", {"url":"https://example.com", "max_clicks":limit})[0],400)
        self.assertEqual(self.request("POST", "/api/links", {"url":"https://example.com", "expires_at":"2020-01-01T00:00:00Z"})[0],400)
        self.assertEqual(self.request("POST", "/api/links", {"url":"https://example.com"}, {"Origin":"https://evil.example"})[0],403)
        self.assertEqual(self.request("GET", "/api/dashboard", headers={"Host":"evil.example"})[0],403)
        self.assertEqual(self.request("POST", "/api/links", {"url":"https://example.com", "code":"api"})[0],400)
        self.create(code="unique")
        self.assertEqual(self.request("POST", "/api/links", {"url":"https://example.com", "project_id":self.project_id, "code":"unique"})[0],409)

    def test_persistence_export_and_assets(self):
        code = self.create()
        self.request("GET", "/"+code, headers={"Referer":"https://example.org/page"})
        # Initialize the same database again: startup must preserve all records.
        from server import initialize
        initialize(self.db_path)
        self.assertEqual(self.dashboard()["links"][0]["clicks"],1)
        status, headers, body = self.request("GET", "/api/export")
        self.assertEqual(status,200)
        self.assertIn("text/csv",headers["Content-Type"])
        self.assertIn("example.org",body.decode("utf-8-sig"))
        for asset in ["/","/app.js","/style.css","/favicon.svg"]:
            self.assertEqual(self.request("GET",asset)[0],200)
        self.assertEqual(self.request("GET","/assets/link-empty.png")[0],200)
        self.assertEqual(self.request("GET","/assets/../../server.py")[0],404)
        self.assertEqual(self.request("GET","/assets/../data/linklab.db")[0],404)

    def test_unicode_url_is_safe_for_location_header(self):
        code = self.create(url="https://пример.рф/страница?слово=тест#раздел")
        status, headers, _ = self.request("GET", "/"+code)
        self.assertEqual(status,302)
        self.assertTrue(headers["Location"].isascii())
        self.assertIn("xn--", headers["Location"])


if __name__ == "__main__":
    unittest.main(verbosity=2)
