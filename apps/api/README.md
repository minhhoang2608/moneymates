# MoneyMates API

Django + DRF. Copy `.env.example` to `.env` and fill it in (never commit it).

```bash
pip install -r requirements-dev.txt
ruff check .
ruff format --check .
pytest
```

Endpoints: `GET /health`, `GET /me/features`, `POST /ai/parse-text`, `POST /ai/parse-bill`.

### `POST /ai/parse-text`

Headers: `X-App-Secret` (must equal `APP_SHARED_SECRET`) and `X-Device-Id`.
Body: `{"text": "...", "categories": ["..."], "members": ["..."]}` (`categories`, `members` optional).
Response: `{"amount": int|null, "currency": "VND", "note": str|null, "category": str|null, "payer": str|null}`.

Errors: 400 `invalid_input`, 401 `unauthorized`, 403 `ai_disabled`, 429 `quota_exceeded`, 502 `ai_unavailable`.

### `POST /ai/parse-bill`

Same headers. Multipart body: `image` (JPEG or PNG, at most `AI_BILL_MAX_BYTES`, default 1.5 MB) and optional `categories` (JSON array of strings). The image is processed in memory and never stored or logged.
Response: `{"amount": int|null, "currency": "VND", "shop": str|null, "date": "YYYY-MM-DD"|null, "category": str|null}`.
Errors are the same as parse-text. Models come from `OPENROUTER_VISION_MODELS` (falls back to `OPENROUTER_MODELS`); set it to vision-capable models on the server.

Env vars: `OPENROUTER_VISION_MODELS`, `AI_BILL_MAX_BYTES`, `OPENROUTER_API_KEY`, `OPENROUTER_MODELS` (comma-separated, tried in order), `OPENROUTER_TIMEOUT_S` (per model, default 10), `AI_LIMIT_PER_MINUTE` (20), `AI_LIMIT_PER_DAY` (50), `APP_SHARED_SECRET`.

## Deploy on Hawk Host

Live at `https://moneymates-api.brandkey.net` (cPanel account on a CloudLinux + LiteSpeed server).

1. Git Version Control: clone `https://github.com/minhhoang2608/moneymates.git` to `~/moneymates` (branch `dev`).
2. Setup Python App: Python 3.12, app root `moneymates/apps/api`, URL = the API domain, startup file
   `config/wsgi.py`, entry point `application`. Run Pip Install with `requirements.txt`.
3. Environment variables (same page): `DJANGO_SECRET_KEY`, `DJANGO_DEBUG=0`, `ALLOWED_HOSTS`,
   `APP_SHARED_SECRET`, `CACHE_BACKEND=db`, `OPENROUTER_*`. Do **not** set `DATABASE_URL`: the host's
   PostgreSQL is 10.x and Django 5.2 needs 14+, so the API uses SQLite (`db.sqlite3`, git-ignored). It only
   stores request counters.
4. Execute python script: `manage.py migrate`, then `manage.py createcachetable`.
5. LiteSpeed on this host ignores the Passenger block that step 2 writes, so requests go through CGI.
   In the cPanel Terminal: `bash ~/moneymates/apps/api/deploy/hawkhost/install.sh`. It installs
   `cgi-bin/django.cgi` (reads the env vars from step 3) and the rewrite rules in the domain's `.htaccess`.
6. Check `curl https://moneymates-api.brandkey.net/health`.

Auto-deploy: a cPanel cron job runs `deploy/hawkhost/update.sh` every 5 minutes. When `dev` moved it
fast-forwards `~/moneymates`, reinstalls requirements if they changed, re-runs `install.sh`, migrates (via
`manage_with_env.py`, which loads the Python App env vars) and logs to `~/logs/moneymates-api-deploy.log`. CGI starts Python per request (about a second); fine for this low-traffic API.

Note: request counters use the Django cache. With PostgreSQL the cache is a DB cache table (`django_cache`, created by `createcachetable`); otherwise LocMem, which is per process. `DatabaseCache.incr` is not atomic, so concurrent workers may slightly undercount a soft quota.

`GET /banks/apps` (headers `X-App-Secret`, `X-Device-Id`): VietQR bank-app registry merged by appId, cached for `BANKS_CACHE_TTL_S` (24 h) with a last-good copy served as `stale: true` when VietQR is down; 503 `banks_unavailable` if nothing was ever cached.
