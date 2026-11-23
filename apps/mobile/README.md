# MoneyMates mobile

## Environment variables (build time, `EXPO_PUBLIC_*`)

- `EXPO_PUBLIC_API_URL`: base URL of the Django API.
- `EXPO_PUBLIC_APP_SECRET`: shared secret sent as `X-App-Secret`. It is embedded in the bundle, so it is a
  rate-limit secret, not a key.
  It is deliberately absent from `.env.example` (a golden test allows only URL/0/1 placeholders there): set it
  in your local env file or the CI build env.
- `EXPO_PUBLIC_E2E`: `1` swaps in mock adapters (scanner, voice, AI, bank opener).

## API client (`src/api/`)

`apiGet`, `apiPost(path, json)` and `apiPostMultipart(path, formData)` add `X-App-Secret` and `X-Device-Id`
(a UUID kept in `app_setting`). Failures throw `ApiError` with a `code` (`invalid_input`, `unauthorized`,
`ai_disabled`, `quota_exceeded`, `ai_unavailable`, `timeout`, `network`, `http_error`, `not_configured`) and a
Vietnamese `message`. JSON calls time out after 5 s, multipart after 30 s; pass `{ timeoutMs }` to override.

## E2E adapter seam

With `EXPO_PUBLIC_E2E=1` the calls go to `src/e2e/apiAdapter.ts` and never touch the network. Register mock
responses with `registerE2eApiFixture("POST /ai/parse-text", {...})`; unknown routes fail with `network`.
