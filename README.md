# MoneyMates

An iOS/Android expense tracker for Vietnamese users. Log a payment by scanning a **VietQR** code and handing it to your bank or wallet app, by typing it, by voice, or by photographing a bill. Track group trip expenses, split them, and settle them "Tôi thu hộ" style: everyone pays or receives only from "me", each with a VietQR code.

v1 is **local-first and offline**: the data lives in SQLite on the phone. The only server is a small Django API that holds the OpenRouter key for the AI features. There is no login, sync or backup in v1. The UI is in Vietnamese.

The project is built by an **AI software factory** (BA, Tech Lead, Dev and Tester agents running in GitHub Actions). See [How the factory works](#how-the-factory-works).

## Features

- **Pay by QR:** scan a VietQR (or pick a QR image), confirm the amount, choose a bank/wallet app and hand off. Autofill-capable apps open with the transfer prefilled; other apps get the QR image or the copied text.
- **Add an expense** by manual entry, **voice** (Vietnamese speech, offline rules first, AI for the unclear parts), or **bill photo** (AI reads amount, shop, date and category).
- **Groups:** members, shared expenses, equal / by-amount / by-percent splits with exact remainders, balances and a per-member settlement QR.
- **Overview, history and statistics** with the monthly total, top categories and a month-over-month alert.
- **Bank notifications** (Android, opt-in): detect a payment from the bank app's notification and mark it paid.
- **Receipt share:** share a bank transfer receipt to MoneyMates to record or match a payment.

Money is always an **integer number of VND**, never a float.

## Architecture

```text
Phone (Expo app)                       Server
  UI + logic ── SQLite (all v1 data)     Django + DRF ── PostgreSQL (Supabase)
  VietQR parse/generate on device  ───►  /ai/parse-text, /ai/parse-bill ──► OpenRouter
  deeplink / clipboard ──► bank app      /me/features, /banks/apps, /health
```

- The app never talks to a database or a third-party AI directly. Everything goes through the Django API.
- No secrets in code or in the app. Keys live in GitHub secrets and in server environment variables.
- Sync-ready schema from day one: UUID primary keys generated on the device, `created_at` / `updated_at` / `deleted_at` on every table, nullable `owner_id`, identical names in Drizzle and Django.

## Repository layout

```text
apps/mobile/   Expo (React Native, TypeScript, expo-router, expo-sqlite + Drizzle, Zustand, TanStack Query)
apps/api/      Django + DRF (Python 3.12): /ai/parse-text, /ai/parse-bill, /me/features, /banks/apps, /health
tests/golden/  Golden fixtures for money logic (read-only for agents)
docs/          Requirements and design, human-owned (read-only for agents)
.claude/       Agent definitions, skills, hooks, settings
.github/       Workflows, factory limits (factory.env), templates
scripts/       Factory helper scripts and the APK download script
```

## Documentation

| Document                           | Content                                                |
| ---------------------------------- | ------------------------------------------------------ |
| `docs/plan-chuc-nang-giao-dien.md` | Product requirements, screens, data model (Vietnamese) |
| `docs/tech-stack.md`               | Technical decisions (Vietnamese)                       |
| `docs/ai-software-factory.md`      | How the factory works (Vietnamese)                     |
| `docs/factory-setup.md`            | Human setup checklist                                  |
| `docs/design/README.md`            | UI design export: screen map, tokens, logo             |
| `CLAUDE.md`                        | Rules every agent follows (branches, labels, DoD)      |
| `apps/mobile/README.md`            | Mobile environment variables, API client, E2E seam     |
| `apps/api/README.md`               | API endpoints, env vars, Hawk Host deploy              |

## Getting started

### Mobile (`apps/mobile`)

Requirements: Node 22, and Java 17 plus the Android SDK for native builds.

```bash
cd apps/mobile
npm ci
cp .env.example .env        # placeholders only; never commit .env
npm start                   # Expo dev server
```

On Windows without Visual Studio, `better-sqlite3` (used by the tests) cannot build: install with `npm ci --ignore-scripts` and run the tests that do not need it.

Environment variables (see [apps/mobile/README.md](apps/mobile/README.md)):

| Variable                 | Meaning                                                                   |
| ------------------------ | ------------------------------------------------------------------------- |
| `EXPO_PUBLIC_API_URL`    | Base URL of the Django API                                                |
| `EXPO_PUBLIC_APP_SECRET` | Shared secret sent as `X-App-Secret` (a rate-limit secret, not a key)     |
| `EXPO_PUBLIC_E2E`        | `1` swaps in mock adapters (scanner, voice, AI, bank opener); `0` in prod |

Checks (CI runs the same):

```bash
npm run lint          # eslint + prettier --check
npm run typecheck
npm test
npm run test:golden   # tests/golden fixtures for the money logic
```

End-to-end flows are Maestro files in `apps/mobile/.maestro/`, run on an Android emulator in CI (`e2e.yml`) against a build with `EXPO_PUBLIC_E2E=1`.

### API (`apps/api`)

Requirements: Python 3.12.

```bash
cd apps/api
python -m venv .venv && source .venv/bin/activate     # Windows: .venv\Scripts\activate
pip install -r requirements-dev.txt
cp .env.example .env                                   # never commit .env
ruff check . && ruff format --check .
pytest                                                 # OpenRouter is mocked, never called
```

Without `DATABASE_URL` the API uses SQLite. Endpoints, environment variables and the Hawk Host deployment are in [apps/api/README.md](apps/api/README.md). The live API is `https://moneymates-api.brandkey.net` (`GET /health`).

### Formatting

Prettier formats everything except Python (ruff). From the repo root:

```bash
npm ci
npm run format          # write
npm run format:check    # what CI runs
```

## Building an Android APK

The `nightly-apk.yml` workflow builds a release APK (arm64-v8a, real API) from `dev` every night and on demand, and uploads it as the `moneymates-apk` artifact.

```powershell
# Windows: triggers the build if today's is missing, waits, and downloads the APK
./scripts/download-latest-apk.ps1
```

You can also run the workflow from the GitHub Actions tab and download the artifact, or build locally:

```bash
cd apps/mobile
npx expo prebuild --platform android --no-install --clean
cd android && ./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a
```

The build reads the repository variable `API_URL` and the secret `APP_SHARED_SECRET`. Android may show a Google Play Protect warning for the test build because the app has a notification-listener service; choose "Install anyway".

## How the factory works

Work flows through GitHub issues and PRs, moved along by agents and workflow scripts:

```text
BA writes a feature ── Tech Lead triage splits it by area ── Dev (FE / BE / Fullstack) opens a PR into dev
  ── Tech Lead reviews and merges ── Tester verifies on dev ── closed (a failed check files a type:bug ticket)
```

- **Branches:** `dev` is the default and integration branch; every PR targets `dev`. `main` is for releases and is human-only. Work branches are `feat/<issue>-<slug>` and `fix/<issue>-<slug>`.
- **Labels:** each issue has exactly one `status:*` label. Agents never add or remove `status:*`, `agent:*` or `needs-human` themselves; they report to `.factory/result.json` and the scripts in `scripts/factory/` apply the change.
- **`needs-human`:** the factory skips the ticket until a human removes the label (stuck work, real-device checks, design updates).
- **PRs** use `Refs #<issue>`, never `Closes`; the Tester closes tickets after verifying them on `dev`. Commits are Conventional Commits that mention the issue, for example `feat(mobile): parse VietQR payload (#12)`. No AI attribution in commits or PR text.
- **Definition of Done:** acceptance criteria met, lint/typecheck/unit/API/golden tests green, new behaviour covered by tests (Maestro for main flows), Tech Lead review green, verified on `dev`. Anything that needs a physical phone (bank deeplinks, camera, speech) is flagged `test:real-device` for a human.
- **E2E** runs only when it can tell something new (nightly, or when the Tester needs evidence and `dev` changed). A red run opens a `type:bug` ticket with the failed flows and their screenshots.

Full details: `CLAUDE.md`, `docs/ai-software-factory.md` and `docs/factory-setup.md`.

## Contributing

Read `CLAUDE.md` first. Keep each PR to one ticket, follow the existing style, add tests, and write code, commits and tickets in English (UI strings stay Vietnamese). `docs/` and `tests/golden/` are human-owned: do not edit them from an agent run.
