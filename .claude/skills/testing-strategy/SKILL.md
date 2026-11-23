---
name: testing-strategy
description: MoneyMates test pyramid – unit tests (Jest), API tests (pytest, OpenRouter mocked), read-only golden fixtures in tests/golden, and E2E with Maestro on an Android emulator in CI with mock data for QR, voice and AI. Load when writing or judging tests.
---

# Testing strategy

| Level | Tool | Where | Runs in | Covers |
| --- | --- | --- | --- | --- |
| Unit | Jest (`jest-expo`) | `apps/mobile/src/**/__tests__/` | CI on every PR | VietQR TLV/CRC, money parsing, splits, settlement, stats, category matcher, stores |
| Golden | Jest runner `npm run test:golden` | fixtures in `tests/golden/` | CI on every PR | canonical money and QR cases, human-owned |
| API | pytest + DRF `APIClient` | `apps/api/**/tests/` | CI on every PR | `/ai/parse-*`, `/me/features`, request limits, fallbacks |
| E2E | Maestro | `apps/mobile/.maestro/*.yaml` | Tester, after merge into `dev` | main flows on an Android emulator |

Every ticket's acceptance criteria map to tests at the lowest level that can prove them. E2E is only for main user flows.

## Unit tests (mobile)

- Business logic lives in pure modules (`src/lib/**`) and is tested without React Native.
- Components are tested with `@testing-library/react-native` only for logic-bearing UI (form validation, split-mismatch warning).
- SQLite repositories run against an in-memory database or a mocked Drizzle driver. Test soft delete and `updated_at` bumps.

## Golden tests (`tests/golden/`, read-only for agents)

- Layout: `tests/golden/<domain>/<case>.json`, where domain is one of `money-parse`, `split`, `settlement`, `stats`, `vietqr-generate`, `vietqr-parse` (more may be added by humans).
- Case format: `{ "name": "...", "input": { ... }, "expected": { ... } }`. Errors are expected as `{ "error": "<code>" }`. **`tests/golden/README.md` defines the exact input and expected shape per domain.** Your pure functions' signatures must accept those shapes, or the runner adapts them.
- `apps/mobile` provides `npm run test:golden`. It discovers every JSON file and calls the matching pure function. Fullstack writes this runner in the scaffolding ticket.
- Agents never create, edit or delete files here (hooks block it). If a golden case seems wrong, report `blocked`. Humans add cases (Tech Lead may request them in a `needs-human` ticket).

## API tests

- **Never call OpenRouter.** Patch the client function (for example `apps/api/ai/client.py::complete`) or use `responses`. Fixtures in `apps/api/ai/tests/fixtures/` hold sample model outputs: valid, malformed JSON, empty, timeout, and 429 → fallback model.
- Cover: input validation, response schema (amount is an integer VND), unknown category → "Khác", rate limit per device id + app secret (429 with a Vietnamese-friendly message code), missing or invalid app secret → 401/403.

## E2E (Maestro on an Android emulator)

- Runs only in `tester.yml` after merges into `dev`, on the Linux runner (`reactivecircus/android-emulator-runner`, API 34, x86_64). No human machine needs Android Studio.
- The app is built as a release APK with **`EXPO_PUBLIC_E2E=1`**, which switches to mock data:
  - **QR:** the emulator has no camera. In E2E mode the app accepts a deep link `moneymates://e2e/scan?payload=<urlencoded VietQR>`, used by Maestro `openLink`, which goes straight to the confirm screen. Sample payloads live in `apps/mobile/e2e/fixtures/qr.json`.
  - **Voice:** speech recognition is replaced by fixture transcripts (`e2e/fixtures/voice.json`), for example "ăn phở 50 nghìn", "Nam trả tiền xăng 200k".
  - **AI:** `/ai/*` calls return fixture responses (`e2e/fixtures/ai.json`). There is no network dependency.
  - **Bank apps:** "open app" is replaced by a confirmation toast. Clipboard and image saving are still exercised.
- Main flows to cover over time: add a manual transaction; create a group and add members; split an expense (equal / amount / percent); open Tổng kết and see the settlement list; open the payback QR popup; QR scan → confirm → Thanh toán saves the transaction.
- Flows use `testID`s (`accessibilityLabel` fallback), never coordinates. Screenshots are taken on failure. Artifacts are uploaded as `e2e-results`.

## Only on a real phone (`test:real-device`)

Bank deeplink autofill (TPBank, Techcombank, Vietcombank, MBBank, MoMo), camera scanning of printed QR codes, vi-VN speech recognition quality, Face ID / fingerprint lock. The Tester flags these and a human tests them on an installed build.

## Rules

- Tests are deterministic: fixed dates (inject a clock), no real network, no randomness without a seed.
- A bug fix starts with a failing regression test.
- Never weaken or skip an existing test to get green. Never touch `tests/golden/`.
