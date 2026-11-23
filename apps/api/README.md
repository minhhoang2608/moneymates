# MoneyMates API

Django + DRF. Copy `.env.example` to `.env` and fill it in (never commit it).

```bash
pip install -r requirements-dev.txt
ruff check .
ruff format --check .
pytest
```

Endpoints: `GET /health`, `GET /me/features`, `POST /ai/parse-text`.

### `POST /ai/parse-text`

Headers: `X-App-Secret` (must equal `APP_SHARED_SECRET`) and `X-Device-Id`.
Body: `{"text": "...", "categories": ["..."], "members": ["..."]}` (`categories`, `members` optional).
Response: `{"amount": int|null, "currency": "VND", "note": str|null, "category": str|null, "payer": str|null}`.

Errors: 400 `invalid_input`, 401 `unauthorized`, 403 `ai_disabled`, 429 `quota_exceeded`, 502 `ai_unavailable`.

Env vars: `OPENROUTER_API_KEY`, `OPENROUTER_MODELS` (comma-separated, tried in order), `OPENROUTER_TIMEOUT_S` (per model, default 10), `AI_LIMIT_PER_MINUTE` (20), `AI_LIMIT_PER_DAY` (50), `APP_SHARED_SECRET`.

Note: request counters use the Django cache. The default LocMem cache is per process; in production use a DB cache (`createcachetable`).
