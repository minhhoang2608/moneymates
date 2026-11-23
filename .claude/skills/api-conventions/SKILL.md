---
name: api-conventions
description: Conventions for apps/api – Django + DRF on Hawk Host Python App, PostgreSQL, OpenRouter behind /ai/* with free-model fallback and timeouts, per-device request limiting, feature flags, env-only secrets, pytest and ruff. Load for any area:api work.
---

# API conventions (`apps/api`)

## Stack

Python 3.12 · Django (LTS) + Django REST Framework · PostgreSQL in production (SQLite allowed for tests) · `httpx` for OpenRouter · pytest + pytest-django · ruff (lint + format) · optional mypy. It is deployed by a human to the Hawk Host "Python App" (Passenger WSGI). It must start cold quickly, with no background workers and no WebSockets.

## Layout

```text
apps/api/
  manage.py
  pyproject.toml            ruff, pytest, mypy config
  requirements.txt          pinned runtime deps
  requirements-dev.txt      -r requirements.txt + test/lint deps
  .env.example              placeholders only
  config/                   settings (env-driven), urls, wsgi
  ai/                       /ai/parse-text, /ai/parse-bill: views, serializers, client.py (OpenRouter), prompts.py, tests/
  core/                     /me/features, request limiting, shared models
```

## Endpoints (v1)

| Endpoint              | Request                                                    | Response                                                                                       |
| --------------------- | ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `POST /ai/parse-text` | `{text, members?: [name], categories?: [{id,name}]}`       | `{amount: int\|null, note, category_id\|null, paid_by: name\|null, type: "expense"\|"income"}` |
| `POST /ai/parse-bill` | multipart `image` (compressed JPEG ≤ ~1 MB), `categories?` | `{amount: int\|null, merchant, date: "YYYY-MM-DD"\|null, category_id\|null, items?: [...]}`    |
| `GET /me/features`    | –                                                          | `{"ai": true, ...}`, a fixed config in v1 (no plan checks yet)                                 |

- Amounts are **integers in VND**. Never return floats.
- Errors use stable machine codes, for example `{"error": "ai_unavailable" | "rate_limited" | "invalid_input"}`. The app maps them to Vietnamese text and falls back to manual entry.
- The unknown or unsure category is `null` and the app shows "Khác". Accept the user's custom categories in the request so the model can choose them.

## OpenRouter

- The key comes from env `OPENROUTER_API_KEY`. Models come from env `OPENROUTER_MODELS` (a comma-separated list of 2–3 free models, tried in order).
- Every call has a timeout (around 20 s total). On a timeout, 429 or 5xx, try the next model. When all fail → `503 ai_unavailable`.
- Ask for JSON output, validate it with a serializer, and coerce amounts to int. Malformed output counts as failure → next model.
- Never log images or full prompts with personal data. Log the model name, latency and outcome only.

## Request limiting

- Every `/ai/*` call needs headers `X-Device-Id` and `X-App-Secret`. The app secret comes from env `APP_SHARED_SECRET`. A wrong or missing secret → 401.
- Limit per device id per minute and per day (env-configurable, default under the OpenRouter free quota: 20/min, 50/day overall). Use Django cache (DB cache table in production) so it works on shared hosting. Over the limit → `429 rate_limited`.
- Design the permission classes so Pro checks can be added later without changing views.

## Settings and secrets

`DJANGO_SECRET_KEY`, `DATABASE_URL`, `OPENROUTER_API_KEY`, `OPENROUTER_MODELS`, `APP_SHARED_SECRET`, `ALLOWED_HOSTS` are all read from env and listed in `.env.example`. Never commit real values. Never read `.env` from code paths in tests; tests set what they need.

## Models (when server data arrives)

Mirror the Drizzle schema names. UUID primary key (no auto-increment), `created_at`/`updated_at`/`deleted_at`, nullable `owner_id`, and money as `BigIntegerField` + `currency`. v1 needs no app data tables.

## Tests

pytest with DRF `APIClient`, and OpenRouter always mocked (see `testing-strategy`). `ruff check . && ruff format --check . && pytest -q` must pass.
