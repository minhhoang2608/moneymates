"""CGI entry point for Hawk Host.

LiteSpeed on Hawk Host ignores the CloudLinux Passenger directives that cPanel's "Setup Python App"
writes, so the app never starts that way. Instead every request is rewritten to this script, which
runs Django once per request through WSGI-over-CGI.

``install.sh`` copies this file to ``<docroot>/cgi-bin/django.cgi`` and replaces the first line with
the app virtualenv's Python. Environment variables are read from the cPanel Python App settings
(``~/.cl.selector/python-selector.json``), so they are still managed in one place, in cPanel.
"""

import json
import os
import sys
import traceback
from pathlib import Path
from urllib.parse import unquote_to_bytes, urlsplit

APP_ROOT_REL = "moneymates/apps/api"


def load_app_env(config_path: Path, app_root_rel: str) -> dict[str, str]:
    """Environment variables of one cPanel Python App; empty when the file is missing or invalid."""
    try:
        config = json.loads(config_path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}
    app = config.get(app_root_rel) or {}
    env = app.get("env_vars") or {}
    return {str(k): str(v) for k, v in env.items()}


def path_info_from_uri(request_uri: str) -> str:
    """WSGI PATH_INFO (bytes decoded as latin-1, per PEP 3333) for the original request URI."""
    path = urlsplit(request_uri).path or "/"
    return unquote_to_bytes(path).decode("latin-1")


def main() -> None:
    import pwd  # POSIX only; the server is Linux
    from wsgiref.handlers import BaseCGIHandler, read_environ

    # Snapshot the request environment before secrets are added, so they never reach request.META.
    request_env = read_environ()
    request_env["SCRIPT_NAME"] = ""
    if request_env.get("REQUEST_URI"):
        request_env["PATH_INFO"] = path_info_from_uri(request_env["REQUEST_URI"])

    home = Path(pwd.getpwuid(os.getuid()).pw_dir)
    app_root = home / APP_ROOT_REL
    os.environ.update(load_app_env(home / ".cl.selector" / "python-selector.json", APP_ROOT_REL))
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
    sys.path.insert(0, str(app_root))
    os.chdir(app_root)

    class Handler(BaseCGIHandler):
        os_environ: dict[str, str] = {}

    handler = Handler(
        sys.stdin.buffer,
        sys.stdout.buffer,
        sys.stderr,
        request_env,
        multithread=False,
        multiprocess=True,
    )
    handler.run_once = True
    try:
        from config.wsgi import application
    except Exception:
        log = home / "logs" / "moneymates-api-cgi.log"
        with log.open("a", encoding="utf-8") as fh:
            fh.write(traceback.format_exc())
        sys.stdout.write("Status: 500 Internal Server Error\r\nContent-Type: text/plain\r\n\r\n")
        sys.stdout.write("Server error\n")
        return
    handler.run(application)


if __name__ == "__main__":
    main()
