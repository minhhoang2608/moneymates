#!/usr/bin/env python3
"""Run manage.py on Hawk Host with the env vars of the cPanel Python App.

Used by update.sh for migrations: ``python manage_with_env.py migrate --noinput``.
"""

import os
import runpy
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from cgi_entry import APP_ROOT_REL, load_app_env  # noqa: E402


def main() -> None:
    import pwd  # POSIX only; the server is Linux

    home = Path(pwd.getpwuid(os.getuid()).pw_dir)
    os.environ.update(load_app_env(home / ".cl.selector" / "python-selector.json", APP_ROOT_REL))
    app_root = home / APP_ROOT_REL
    os.chdir(app_root)
    sys.path.insert(0, str(app_root))
    sys.argv = ["manage.py", *sys.argv[1:]]
    runpy.run_path(str(app_root / "manage.py"), run_name="__main__")


if __name__ == "__main__":
    main()
