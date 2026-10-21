"""LinkLab: local link manager. Python 3.10+, no external dependencies."""
import argparse
import csv
import hashlib
import io
import json
import mimetypes
import re
import secrets
import socket
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from http import cookies
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit, parse_qs, quote, urlunsplit

ROOT = Path(__file__).resolve().parent


def now():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


@contextmanager
def connect(path):
    db = sqlite3.connect(path, timeout=15)
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA foreign_keys=ON")
    try:
        with db:
            yield db
    finally:
        db.close()


def initialize(path):
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    with connect(path) as db:
        db.execute("PRAGMA journal_mode=WAL")
        db.executescript("""
        CREATE TABLE IF NOT EXISTS links (
          id INTEGER PRIMARY KEY, code TEXT NOT NULL UNIQUE,
          title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', url TEXT NOT NULL, created_at TEXT NOT NULL,
          expires_at TEXT, max_clicks INTEGER, enabled INTEGER NOT NULL DEFAULT 1,
          clicks INTEGER NOT NULL DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS projects (
          id INTEGER PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '',
          created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS visits (
          id INTEGER PRIMARY KEY, link_id INTEGER NOT NULL REFERENCES links(id) ON DELETE CASCADE,
          at TEXT NOT NULL, visitor TEXT NOT NULL, device TEXT NOT NULL,
          browser TEXT NOT NULL, referrer TEXT NOT NULL, outcome TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS visits_link_at ON visits(link_id, at);
        CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
        """)
        columns = {row[1] for row in db.execute("PRAGMA table_info(links)")}
        if "project_id" not in columns:
            db.execute("ALTER TABLE links ADD COLUMN project_id INTEGER REFERENCES projects(id)")
        if "description" not in columns:
            db.execute("ALTER TABLE links ADD COLUMN description TEXT NOT NULL DEFAULT ''")
        if db.execute("SELECT 1 FROM links WHERE project_id IS NULL LIMIT 1").fetchone():
            db.execute("INSERT INTO projects (name,description,created_at) SELECT 'Входящие','Ссылки, созданные до обновления LinkLab.',? WHERE NOT EXISTS (SELECT 1 FROM projects)", (now(),))
            inbox = db.execute("SELECT id FROM projects WHERE name='Входящие' ORDER BY id LIMIT 1").fetchone()[0]
            db.execute("UPDATE links SET project_id=? WHERE project_id IS NULL", (inbox,))
        db.execute("INSERT OR IGNORE INTO settings VALUES ('salt', ?)", (secrets.token_hex(32),))


def status(link):
    if not link["enabled"]:
        return "paused"
    if link["expires_at"] and link["expires_at"] <= now():
        return "expired"
    if link["max_clicks"] is not None and link["clicks"] >= link["max_clicks"]:
        return "limit"
    return "active"


def validate(data, old=None):
    url = str(data.get("url", "")).strip()
    if "://" not in url:
        url = "https://" + url
    try:
        parts = urlsplit(url)
        _ = parts.port
        valid = parts.scheme in ("http", "https") and parts.hostname and not parts.username and not parts.password
    except ValueError:
        valid = False
    if not valid or len(url) > 4096 or re.search(r"[\x00-\x20\x7f]", url):
        raise ValueError("Введите корректную ссылку HTTP или HTTPS без пробелов и данных для входа.")
    try:
        hostname = parts.hostname.encode("idna").decode("ascii")
        netloc = (f"[{hostname}]" if ":" in hostname else hostname) + (f":{parts.port}" if parts.port else "")
        url = urlunsplit((parts.scheme, netloc, quote(parts.path, safe="/%:@!$&'()*+,;=-._~"),
                         quote(parts.query, safe="=&?/%:@!$'()*+,;~-._"), quote(parts.fragment, safe="/%?:@!$&'()*+,;=-._~")))
    except UnicodeError:
        raise ValueError("Некорректное имя сайта.")
    title = str(data.get("title", "")).strip() or parts.hostname
    if len(title) > 120:
        raise ValueError("Название должно быть не длиннее 120 символов.")
    description = str(data.get("description", "")).strip()
    if len(description) > 500:
        raise ValueError("Описание должно быть не длиннее 500 символов.")
    expiry = data.get("expires_at") or None
    if expiry:
        try:
            dt = datetime.fromisoformat(expiry.replace("Z", "+00:00"))
            if dt.tzinfo is None:
                raise ValueError()
            expiry = dt.astimezone(timezone.utc).isoformat(timespec="seconds")
        except (ValueError, AttributeError):
            raise ValueError("Некорректная дата окончания.")
        if expiry <= now() and (not old or expiry != old["expires_at"]):
            raise ValueError("Срок действия должен быть в будущем.")
    limit = data.get("max_clicks")
    if limit in (None, ""):
        limit = None
    elif type(limit) is not int or not 1 <= limit <= 1000000000:
        raise ValueError("Лимит — целое число от 1 до 1 000 000 000.")
    return dict(url=url, title=title, description=description, expires_at=expiry, max_clicks=limit)


class Handler(BaseHTTPRequestHandler):
    server_version = "LinkLab/1.0"

    def parse_request(self):
        if not super().parse_request():
            return False
        try:
            host = urlsplit("//" + self.headers.get("Host", "")).hostname
        except ValueError:
            host = None
        # Prevent other domain names from reaching the local management panel.
        if host not in {"localhost", "127.0.0.1", "::1", self.connection.getsockname()[0]}:
            self.send(403, {"error": "Недопустимый адрес сервера."})
            return False
        return True

    def log_message(self, fmt, *args):
        pass

    def send(self, code, body=b"", mime="application/json; charset=utf-8", headers=None):
        if isinstance(body, (dict, list)):
            body = json.dumps(body, ensure_ascii=False).encode()
        elif isinstance(body, str):
            body = body.encode()
        self.send_response(code)
        self.send_header("Content-Type", mime)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "strict-origin-when-cross-origin")
        self.send_header("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'")
        for key, value in (headers or {}).items():
            self.send_header(key, value)
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)

    def do_HEAD(self):
        self.do_GET()

    def do_GET(self):
        path = urlsplit(self.path).path
        if path.startswith("/api/"):
            return self.api_get(path)
        assets = {"/": ("index.html", "text/html; charset=utf-8"),
                  "/app.js": ("app.js", "text/javascript; charset=utf-8"),
                  "/style.css": ("style.css", "text/css; charset=utf-8"),
                  "/favicon.svg": ("favicon.svg", "image/svg+xml")}
        if path in assets:
            filename, mime = assets[path]
            return self.send(200, (ROOT / "static" / filename).read_bytes(), mime)
        if path.startswith("/assets/"):
            directory = (ROOT / "static" / "assets").resolve()
            asset = (ROOT / "static" / path.lstrip("/")).resolve()
            if asset.is_relative_to(directory) and asset.is_file():
                mime = {".js":"text/javascript", ".css":"text/css"}.get(asset.suffix) or mimetypes.guess_type(asset.name)[0] or "application/octet-stream"
                return self.send(200, asset.read_bytes(), mime)
            return self.send(404, {"error": "Файл не найден"})
        if re.fullmatch(r"/[A-Za-z0-9_-]{3,40}", path):
            return self.redirect(path[1:])
        self.error_page(404, "Ссылка не найдена", "Проверьте адрес: возможно, ссылка была удалена.")

    def api_get(self, path):
        if path not in ("/api/dashboard", "/api/export"):
            return self.send(404, {"error": "Не найдено"})
        with connect(self.server.db_path) as db:
            links = [dict(row) for row in db.execute("SELECT * FROM links ORDER BY id DESC")]
            for link in links:
                link["status"] = status(link)
            if path == "/api/dashboard":
                projects = [dict(row) for row in db.execute("SELECT * FROM projects ORDER BY id DESC")]
                visits = [dict(row) for row in db.execute("""SELECT v.link_id, l.project_id, v.at, v.visitor, v.device, v.browser, v.referrer, v.outcome
                  FROM visits v JOIN links l ON l.id=v.link_id ORDER BY v.id DESC""")]
                # The browser receives aggregated data; visitor hashes stay in SQLite.
                unique = len({v["visitor"] for v in visits if v["outcome"] == "ok"})
                by_link = {}
                by_project = {}
                for v in visits:
                    if v["outcome"] == "ok":
                        by_link.setdefault(v["link_id"], set()).add(v["visitor"])
                        by_project.setdefault(v["project_id"], set()).add(v["visitor"])
                    v.pop("visitor")
                for link in links:
                    link["unique"] = len(by_link.get(link["id"], set()))
                for project in projects:
                    scoped = [link for link in links if link["project_id"] == project["id"]]
                    project["link_count"] = len(scoped)
                    project["active_count"] = sum(link["status"] == "active" for link in scoped)
                    project["clicks"] = sum(link["clicks"] for link in scoped)
                    project["unique"] = len(by_project.get(project["id"], set()))
                return self.send(200, {"projects": projects, "links": links, "visits": visits, "unique": unique, "server_time": now()})
            query = parse_qs(urlsplit(self.path).query)
            link_id = query.get("link_id", [None])[0]
            out = io.StringIO(newline="")
            writer = csv.writer(out)
            writer.writerow(["Время (UTC)", "Код ссылки", "Результат", "Устройство", "Браузер", "Источник"])
            rows = db.execute("""SELECT v.at, l.code, v.outcome, v.device, v.browser, v.referrer
                FROM visits v JOIN links l ON l.id=v.link_id
                WHERE (? IS NULL OR l.id=?) ORDER BY v.id DESC""", (link_id, link_id))
            for row in rows:
                # Neutralize spreadsheet formulas in untrusted referrer fields.
                writer.writerow([("'" + x) if isinstance(x, str) and x.startswith(("=", "+", "-", "@")) else x for x in row])
            return self.send(200, b"\xef\xbb\xbf" + out.getvalue().encode(), "text/csv; charset=utf-8",
                             {"Content-Disposition": 'attachment; filename="linklab-statistics.csv"'})

    def do_POST(self):
        self.mutate()

    def do_PATCH(self):
        self.mutate()

    def do_DELETE(self):
        self.mutate()

    def mutate(self):
        origin = self.headers.get("Origin")
        if origin and origin != "http://" + self.headers.get("Host", ""):
            return self.send(403, {"error": "Запрос с другого сайта запрещён."})
        if self.headers.get("Content-Type", "").split(";")[0] != "application/json":
            return self.send(415, {"error": "Ожидается JSON."})
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if not 0 <= length <= 16384:
                raise ValueError("Слишком большой запрос.")
            data = json.loads(self.rfile.read(length) or b"{}")
            if not isinstance(data, dict):
                raise ValueError("Некорректный запрос.")
            path = urlsplit(self.path).path
            with connect(self.server.db_path) as db:
                if self.command == "POST" and path == "/api/projects":
                    name = str(data.get("name", "")).strip()
                    description = str(data.get("description", "")).strip()
                    if not name or len(name) > 80:
                        raise ValueError("Название проекта обязательно и должно быть до 80 символов.")
                    if len(description) > 500:
                        raise ValueError("Описание должно быть не длиннее 500 символов.")
                    cursor = db.execute("INSERT INTO projects (name,description,created_at) VALUES (?,?,?)", (name, description, now()))
                    return self.send(201, {"id": cursor.lastrowid})
                if self.command == "POST" and path == "/api/links":
                    values = validate(data)
                    self.check_target(values["url"])
                    project_id = data.get("project_id")
                    if type(project_id) is not int or not db.execute("SELECT 1 FROM projects WHERE id=?", (project_id,)).fetchone():
                        raise ValueError("Выберите существующий проект.")
                    code = str(data.get("code", "")).strip() or secrets.token_urlsafe(5)
                    if not re.fullmatch(r"[A-Za-z0-9_-]{3,40}", code) or code.lower() in ("api", "static", "favicon"):
                        raise ValueError("Код: 3–40 латинских букв, цифр, дефисов или подчёркиваний.")
                    db.execute("INSERT INTO links (code,title,description,url,created_at,expires_at,max_clicks,project_id) VALUES (?,?,?,?,?,?,?,?)",
                               (code, values["title"], values["description"], values["url"], now(), values["expires_at"], values["max_clicks"], project_id))
                    return self.send(201, {"code": code})
                match = re.fullmatch(r"/api/links/(\d+)", path)
                if not match:
                    return self.send(404, {"error": "Не найдено"})
                link = db.execute("SELECT * FROM links WHERE id=?", (match[1],)).fetchone()
                if not link:
                    return self.send(404, {"error": "Ссылка не найдена"})
                if self.command == "DELETE":
                    db.execute("DELETE FROM links WHERE id=?", (link["id"],))
                elif self.command == "PATCH":
                    if set(data) == {"enabled"}:
                        if type(data["enabled"]) is not bool:
                            raise ValueError("Некорректное состояние.")
                        db.execute("UPDATE links SET enabled=? WHERE id=?", (data["enabled"], link["id"]))
                    else:
                        values = validate(data, link)
                        self.check_target(values["url"])
                        db.execute("UPDATE links SET title=?,description=?,url=?,expires_at=?,max_clicks=? WHERE id=?",
                                   (values["title"], values["description"], values["url"], values["expires_at"], values["max_clicks"], link["id"]))
                else:
                    return self.send(405, {"error": "Метод не поддерживается"})
            self.send(200, {"ok": True})
        except sqlite3.IntegrityError:
            self.send(409, {"error": "Этот короткий адрес уже занят. Выберите другой."})
        except (ValueError, TypeError) as exc:
            self.send(400, {"error": str(exc) or "Некорректные данные"})

    def check_target(self, url):
        target = urlsplit(url)
        host = self.headers.get("Host", "")
        if target.netloc.lower() == host.lower() or (target.hostname in ("localhost", "127.0.0.1", "::1") and (target.port or 80) == self.server.server_port):
            raise ValueError("Укажите внешний адрес, чтобы избежать перенаправления LinkLab на самого себя.")

    def redirect(self, code):
        jar = cookies.SimpleCookie()
        try:
            jar.load(self.headers.get("Cookie", ""))
        except cookies.CookieError:
            pass
        ident = jar.get("linklab_visitor")
        ident = ident.value if ident and re.fullmatch(r"[a-f0-9]{32}", ident.value) else secrets.token_hex(16)
        ua = self.headers.get("User-Agent", "").lower()
        device = "Планшет" if "ipad" in ua or ("android" in ua and "mobile" not in ua) else "Телефон" if "mobile" in ua or "iphone" in ua else "Компьютер"
        browser = next((label for marker, label in [("edg", "Edge"), ("opr", "Opera"), ("firefox", "Firefox"), ("chrome", "Chrome"), ("safari", "Safari")] if marker in ua), "Другой")
        try:
            referrer = urlsplit(self.headers.get("Referer", "")).hostname or "Прямой переход"
        except ValueError:
            referrer = "Прямой переход"
        with connect(self.server.db_path) as db:
            # Check and increment under the same write lock, including concurrent requests.
            db.execute("BEGIN IMMEDIATE")
            link = db.execute("SELECT * FROM links WHERE code=?", (code,)).fetchone()
            if not link:
                return self.error_page(404, "Ссылка не найдена", "Возможно, она была удалена или адрес указан неверно.")
            state = status(link)
            if self.command != "HEAD":
                salt = db.execute("SELECT value FROM settings WHERE key='salt'").fetchone()[0]
                visitor = hashlib.sha256((salt + ident).encode()).hexdigest()
                db.execute("INSERT INTO visits (link_id,at,visitor,device,browser,referrer,outcome) VALUES (?,?,?,?,?,?,?)",
                           (link["id"], now(), visitor, device, browser, referrer[:255], "ok" if state == "active" else state))
                if state == "active":
                    db.execute("UPDATE links SET clicks=clicks+1 WHERE id=?", (link["id"],))
            db.commit()
        if state != "active":
            messages = {"paused": ("Ссылка на паузе", "Владелец временно приостановил переходы по этой ссылке."),
                        "expired": ("Время вышло", "Срок действия этой ссылки закончился."),
                        "limit": ("Лимит исчерпан", "По этой ссылке уже совершено максимально допустимое количество переходов.")}
            title, message = messages[state]
            return self.error_page(410, title, message)
        self.send(302, b"", headers={"Location": link["url"], "Set-Cookie": f"linklab_visitor={ident}; Path=/; Max-Age=31536000; HttpOnly; SameSite=Lax"})

    def error_page(self, code, title, message):
        self.send(code, f'''<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>{title} · LinkLab</title><link rel="icon" href="/favicon.svg"><link rel="stylesheet" href="/style.css"><body class="error-body"><main class="error-card"><a class="brand" href="/"><span>Link<span class="brand-light">Lab</span></span></a><div class="error-symbol">↗</div><p class="eyebrow">ССЫЛКА НЕДОСТУПНА · {code}</p><h1>{title}</h1><p>{message}</p><a class="button primary" href="/">Открыть LinkLab <span>↗</span></a></main></body></html>''', "text/html; charset=utf-8")


class ThreadingHTTPServerV6(ThreadingHTTPServer):
    address_family = socket.AF_INET6

    def server_bind(self):
        self.socket.setsockopt(socket.IPPROTO_IPV6, socket.IPV6_V6ONLY, 1)
        super().server_bind()


def make_server(host, port, db_path):
    initialize(db_path)
    server_type = ThreadingHTTPServerV6 if ":" in host else ThreadingHTTPServer
    server = server_type((host, port), Handler)
    server.db_path = str(db_path)
    return server


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="LinkLab local link manager")
    parser.add_argument("--port", type=int, default=8080)
    parser.add_argument("--host", default="localhost")
    parser.add_argument("--db", default=str(ROOT / "data" / "linklab.db"))
    parser.add_argument("--open", action="store_true", help="Open LinkLab in the default browser")
    args = parser.parse_args()
    # Browsers may resolve localhost to either address family. Bind both loopback
    # interfaces so the app works regardless of which address is tried first.
    hosts = ["127.0.0.1", "::1"] if args.host == "localhost" else [args.host]
    servers = [make_server(host, args.port, args.db) for host in hosts]
    print(f"LinkLab: http://localhost:{args.port}", flush=True)
    if args.open:
        import threading
        import webbrowser
        threading.Timer(0.8, lambda: webbrowser.open(f"http://localhost:{args.port}")).start()
    try:
        threads = [threading.Thread(target=server.serve_forever, daemon=True) for server in servers[1:]]
        for thread in threads:
            thread.start()
        servers[0].serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        for server in servers:
            server.shutdown()
            server.server_close()
