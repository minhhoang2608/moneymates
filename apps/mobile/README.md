# MoneyMates mobile

Expo (React Native, TypeScript). See `.env.example` for placeholders.

## Environment variables

- `EXPO_PUBLIC_API_URL`: base URL of the Django API.
- `EXPO_PUBLIC_APP_SECRET`: shared secret sent as `X-App-Secret` (server `APP_SHARED_SECRET`). It is embedded in the bundle: a rate-limit secret, not an API key. CI build jobs must pass `APP_SHARED_SECRET` and `API_URL` as these two variables.
- `EXPO_PUBLIC_E2E`: `1` swaps in mock adapters (no network); `0` in production.

## API client (`src/api`)

- `apiGet`, `apiPost(path, body, { timeoutMs })` (JSON) and `apiPostMultipart(path, form, { timeoutMs })` (FormData, no manual content type; longer default timeout).
- Every request sends `X-App-Secret` and `X-Device-Id` (a UUID generated once, stored in `app_setting` key `device_id`).
- Failures throw `ApiError` with `status` and `code` and a Vietnamese `message` (`vi.apiErrors`).

## E2E adapter seam

With `EXPO_PUBLIC_E2E=1` the client never calls `fetch`. Register canned responses with `registerE2eApiFixture("POST", "/ai/parse-text", value)` from `src/e2e/apiAdapter.ts`; unknown routes fail with a `network` ApiError. Tests can also use `setApiAdapter()`.
