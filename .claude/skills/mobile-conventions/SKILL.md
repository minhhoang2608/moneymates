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
- Design references: logo <https://claude.ai/artifact/2m2qR4FeFweAJzbk9sTkUr#artboard-15dd8cd198dd> and mockup <https://claude.ai/artifact/PxFxv62jrWscb7hbTVEAUu#page-dcb81aee8d83>. These need a login, so use the exports in `docs/design/` when present. Otherwise use a simple, consistent theme in `src/theme.ts` and don't invent a logo.
- Every interactive element has a `testID` (kebab-case, e.g. `qr-confirm-pay-button`) for Maestro.
- Offline first: every core flow works without network. Only `/ai/*` needs network, and AI failure falls back to the manual form with category "Khác".

## E2E mode

`EXPO_PUBLIC_E2E=1` swaps in the adapters from `src/e2e/` (see the `testing-strategy` skill): deep link scan, fixture voice and AI, and a fake bank opener. Production code depends on interfaces, and E2E adapters are chosen at startup. Never ship test-only branches inside business logic.

## Secrets and config

The API base URL and the app's request-limit secret come from `EXPO_PUBLIC_*` env vars at build time. Document them in `apps/mobile/.env.example`. The app never contains the OpenRouter key or DB credentials.
