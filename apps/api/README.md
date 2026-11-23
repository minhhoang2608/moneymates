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

1. In cPanel create a Python App on Python 3.12 with app root `apps/api`, startup file `config/wsgi.py`, then entry point `application`.
2. In the app virtualenv run `pip install -r requirements.txt`.
3. Set the environment variables listed in `.env.example` (real `DJANGO_SECRET_KEY`, `DATABASE_URL`, `APP_SHARED_SECRET`, `OPENROUTER_*`).
4. Run `python manage.py migrate` and `python manage.py createcachetable`.
5. Restart with `touch tmp/restart.txt`.
6. Check `curl https://<host>/health`.

Notes: Hawk Host only allows a local PostgreSQL (`localhost`). Database and user names carry the cPanel account prefix. URL-encode special characters in the password (e.g. `@` becomes `%40`).

Note: request counters use the Django cache. With PostgreSQL the cache is a DB cache table (`django_cache`, created by `createcachetable`); otherwise LocMem, which is per process. `DatabaseCache.incr` is not atomic, so concurrent workers may slightly undercount a soft quota.
