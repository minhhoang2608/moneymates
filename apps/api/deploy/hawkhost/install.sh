#!/usr/bin/env bash
# Install (or update) the CGI entry point of the API on Hawk Host. Run it on the server after every
# `git pull`:
#   bash ~/moneymates/apps/api/deploy/hawkhost/install.sh [docroot]
# docroot defaults to ~/moneymates-api.brandkey.net. VENV_PYTHON overrides the virtualenv Python.
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
docroot="${1:-$HOME/moneymates-api.brandkey.net}"
venv_python="${VENV_PYTHON:-$HOME/virtualenv/moneymates/apps/api/3.12/bin/python}"

[[ -x "$venv_python" ]] || { echo "virtualenv Python not found: $venv_python" >&2; exit 1; }
[[ -d "$docroot" ]] || { echo "docroot not found: $docroot" >&2; exit 1; }

mkdir -p "$docroot/cgi-bin" "$HOME/logs"
{
  echo "#!$venv_python"
  tail -n +2 "$here/cgi_entry.py"
} >"$docroot/cgi-bin/django.cgi"
chmod 755 "$docroot/cgi-bin/django.cgi"

if ! grep -qF "# MONEYMATES CGI BEGIN" "$docroot/.htaccess" 2>/dev/null; then
  printf '\n' >>"$docroot/.htaccess"
  cat "$here/htaccess" >>"$docroot/.htaccess"
fi

echo "Installed $docroot/cgi-bin/django.cgi"
