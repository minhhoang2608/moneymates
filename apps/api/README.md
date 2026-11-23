# MoneyMates API

Django + DRF. Copy `.env.example` to `.env` and fill it in (never commit it).

```bash
pip install -r requirements-dev.txt
ruff check .
ruff format --check .
pytest
```

Endpoints: `GET /health`, `GET /me/features`.
