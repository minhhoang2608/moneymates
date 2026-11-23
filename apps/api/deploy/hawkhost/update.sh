#!/usr/bin/env bash
# Auto-deploy the dev API on Hawk Host from the `dev` branch. Runs from a cPanel cron job:
#   */5 * * * * bash $HOME/moneymates/apps/api/deploy/hawkhost/update.sh >>$HOME/logs/moneymates-api-deploy.log 2>&1
# Does nothing while origin/dev has not moved. Otherwise it fast-forwards, reinstalls the requirements
# when they changed, refreshes the CGI entry, runs migrations and checks /health.
set -euo pipefail

repo="${REPO_DIR:-$HOME/moneymates}"
venv="${VENV_DIR:-$HOME/virtualenv/moneymates/apps/api/3.12}"
domain="${API_DOMAIN:-moneymates-api.brandkey.net}"
here="$repo/apps/api/deploy/hawkhost"

# One run at a time: a slow pip install must not overlap the next cron tick.
exec 9>"$HOME/.moneymates-deploy.lock"
flock -n 9 || exit 0

cd "$repo"
git fetch -q origin dev
old="$(git rev-parse HEAD)"
new="$(git rev-parse origin/dev)"
[[ "$old" == "$new" ]] && exit 0

changed="$(git diff --name-only "$old" "$new" -- apps/api)"
git merge -q --ff-only origin/dev
stamp="$(date -u +%Y-%m-%dT%H:%M:%SZ) ${old:0:7}..${new:0:7}"
if [[ -z "$changed" ]]; then
  echo "$stamp pulled (no API changes)"
  exit 0
fi

if grep -qx 'apps/api/requirements.txt' <<<"$changed"; then
  "$venv/bin/pip" install -q -r apps/api/requirements.txt
fi
bash "$here/install.sh" "$HOME/$domain" >/dev/null
"$venv/bin/python" "$here/manage_with_env.py" migrate --noinput
status="$(curl -s -m 30 -o /dev/null -w '%{http_code}' "https://$domain/health" || true)"
echo "$stamp deployed API, /health -> $status"
