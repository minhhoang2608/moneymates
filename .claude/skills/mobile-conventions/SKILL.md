---
name: mobile-conventions
description: Conventions for apps/mobile – Expo dev build with TypeScript, expo-router tabs, expo-sqlite + Drizzle sync-ready schema, Zustand, TanStack Query, folder layout, Vietnamese UI strings, E2E mode and design references. Load for any area:mobile work.
---

# Mobile conventions (`apps/mobile`)

## Stack (from docs/tech-stack.md, do not substitute)

Expo SDK (latest stable) with a **development build** (not Expo Go, because the speech module is native) · TypeScript strict · `expo-router` · `expo-sqlite` + **Drizzle ORM** (schema and migrations in TS) · Zustand (UI state) · TanStack Query + `fetch` (API) · `expo-camera` (QR scan) · `expo-image-picker` · `react-native-qrcode-svg` · `expo-media-library` + `expo-sharing` · `expo-linking` + `expo-clipboard` · `expo-local-authentication`. Builds go through EAS (human-run).

## Layout

```text
apps/mobile/
  app/                     expo-router routes
    (tabs)/                index (Tổng quan) · history (Lịch sử) · groups (Nhóm) · profile (Hồ sơ); QR button in the tab bar centre
    ...                    modal and stack screens from the 19-screen table in docs
  src/
    lib/                   pure logic, no React: vietqr/, money/, split/, settlement/, stats/, category/
    db/                    Drizzle schema.ts, migrations/, repositories/
    api/                   API client + TanStack hooks (/ai/*, /me/features)
    stores/                Zustand stores
    components/            shared UI
    i18n/vi.ts             all Vietnamese UI strings
    e2e/                   E2E-mode adapters (mock scanner, voice, AI, bank opener)
  e2e/fixtures/            qr.json, voice.json, ai.json
  .maestro/                Maestro flows
```

## Package scripts (CI contract)

`lint` (ESLint + Prettier check), `typecheck` (`tsc --noEmit`), `test` (Jest), `test:golden` (runs `../../tests/golden`). Commit `package-lock.json`.

## Data rules

- Table and field names mirror docs → "Mô hình dữ liệu sơ bộ", and match the Django models. Use snake_case columns.
- Every table: `id` TEXT UUID v4 generated on the device, `created_at`, `updated_at` (ISO UTC), `deleted_at` (nullable), `owner_id` (nullable, personal data). Group data carries `group_id`. `GroupMember` has a nullable `user_id`.
- Amounts are INTEGER đồng + `currency`. See `money-logic`.
- Repositories always filter `deleted_at IS NULL`, set `updated_at` on every write, and soft-delete instead of `DELETE`.
- Default categories are seeded by migration. They can't be deleted, but their icon and colour can change. Deleting a custom category moves its transactions to "Khác".

## UI rules

- All strings live in `src/i18n/vi.ts`, Vietnamese, exactly as in the docs ("Thanh toán", "Tổng kết", "Ghi vào", "QR chung", "Đã trả", "Khác"…).
- **Design source:** `docs/design/README.md` (screen → file map plus tokens) and `docs/design/screens/<Name>.dc.html`. Each screen is plain HTML with inline CSS at 390 × 844. Read the screen file for the ticket's screen and reproduce its layout, spacing, colours and copy in React Native. Put every token in `src/theme.ts`, named as in the README (`primary #0E7C66`, `background #F6F7F9`, `text #111827`, `textMuted #5B6472`, `expense #B42318`, …). Never hard-code hex values in components. Font: Inter (via `expo-font`). App icon: `docs/design/logo/icon.svg`. The original canvases (<https://claude.ai/artifact/PxFxv62jrWscb7hbTVEAUu>, <https://claude.ai/artifact/2m2qR4FeFweAJzbk9sTkUr>) need a login. Don't invent a logo or a colour.
- Every interactive element has a `testID` (kebab-case, e.g. `qr-confirm-pay-button`) for Maestro.
- Offline first: every core flow works without network. Only `/ai/*` needs network, and AI failure falls back to the manual form with category "Khác".

## Mock-first API

Dev FE does not wait for the backend. Every API call goes through an interface in `src/api/` with two adapters per endpoint: `mock` (in `src/api/mock/`, backed by fixtures in `e2e/fixtures/`) and `live` (`fetch` + TanStack Query). The ticket's contract (path, request and response JSON, error codes) is the single source of truth: the mock must return exactly that shape, including the error cases (timeout, 429 `rate_limited`, 503 `ai_unavailable`). A registry (for example `apiAdapters`) maps each endpoint to `mock` or `live`; new endpoints start as `mock` until the **integration ticket** switches them to `live` and adds the contract check that validates the fixtures against the real response. Business logic and screens only see the interface.

## E2E mode

`EXPO_PUBLIC_E2E=1` swaps in the adapters from `src/e2e/` (see the `testing-strategy` skill): deep link scan, fixture voice and AI, and a fake bank opener. Production code depends on interfaces, and E2E adapters are chosen at startup. Never ship test-only branches inside business logic.

## Secrets and config

The API base URL and the app's request-limit secret come from `EXPO_PUBLIC_*` env vars at build time. Document them in `apps/mobile/.env.example`. The app never contains the OpenRouter key or DB credentials.
