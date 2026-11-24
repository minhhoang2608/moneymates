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
   `APP_SHARED_SECRET`, `CACHE_BACKEND=db`, `OPENROUTER_*`, and `DATABASE_URL` pointing at Supabase
   PostgreSQL through the **session pooler**:
   `postgresql://postgres.<project-ref>:<password>@aws-1-ap-south-1.pooler.supabase.com:5432/postgres?sslmode=require`.
   URL-encode special characters in the password (`@` → `%40`, `!` → `%21`, `:` → `%3A`, `/` → `%2F`,
   `#` → `%23`, `%` → `%25`). The host's own PostgreSQL is 10.x (Django 5.2 needs 14+) and Supabase's direct
   connection is IPv6-only, hence the pooler. Hawk Host opened outbound TCP 5432/6543 for this on request.
   Keep the Supabase Data API disabled: the API connects to Postgres directly and the Django tables have no RLS.
   Without `DATABASE_URL` the API falls back to SQLite (`db.sqlite3`, git-ignored).
4. In the cPanel Terminal:
   `~/virtualenv/moneymates/apps/api/3.12/bin/python ~/moneymates/apps/api/deploy/hawkhost/manage_with_env.py migrate`,
   then the same with `createcachetable`.
5. LiteSpeed on this host ignores the Passenger block that step 2 writes, so requests go through CGI.
   In the cPanel Terminal: `bash ~/moneymates/apps/api/deploy/hawkhost/install.sh`. It installs
   `cgi-bin/django.cgi` (reads the env vars from step 3) and the rewrite rules in the domain's `.htaccess`.
6. Check `curl https://moneymates-api.brandkey.net/health`.

Auto-deploy: a cPanel cron job runs `deploy/hawkhost/update.sh` every 5 minutes. When `dev` moved it
fast-forwards `~/moneymates`, reinstalls requirements if they changed, re-runs `install.sh`, migrates (via
`manage_with_env.py`, which loads the Python App env vars) and logs to `~/logs/moneymates-api-deploy.log`. CGI starts Python per request (about a second); fine for this low-traffic API.

Note: with PostgreSQL the per-device request counters live in the `ai_counter` table and are incremented by a single atomic `INSERT ... ON CONFLICT DO UPDATE` (expired rows are reset on hit and culled on about 1 in 50 calls). Otherwise (SQLite, tests) the Django cache is used. If the counter store errors, the limit check fails open (logged warning, request allowed). `banks` cache errors are also tolerated: the service fetches live from VietQR, and answers 503 `banks_unavailable` if that fails too (the app then uses its bundled list). The PostgreSQL connection uses `connect_timeout` (`DB_CONNECT_TIMEOUT_S`, default 5; a `?connect_timeout=` in `DATABASE_URL` wins). The DB cache table is culled at `DB_CACHE_MAX_ENTRIES` (default 1000). `update.sh` runs `migrate`, which creates `ai_counter`.

`GET /health` never touches the database. `GET /health?db=1` runs `SELECT 1`: 200 `{"status":"ok","db":"ok"}` or 503 `{"status":"error","db":"error"}`. Point a daily uptime probe at `/health?db=1` to keep the Supabase project from pausing.

`GET /banks/apps` (headers `X-App-Secret`, `X-Device-Id`): VietQR bank-app registry merged by appId, cached for `BANKS_CACHE_TTL_S` (24 h) with a last-good copy served as `stale: true` when VietQR is down; 503 `banks_unavailable` if nothing was ever cached.
