<!-- Title: Conventional Commit style, e.g. "feat(mobile): parse VietQR payload (#12)". Base branch: dev. -->

Refs #<!-- issue number. Use "Refs", NOT "Closes"/"Fixes": the Tester closes the ticket after verifying it on dev. -->

## Summary

<!-- What changed and why, in 2–5 bullets. -->

## Acceptance criteria

<!-- Copy every AC from the ticket; tick it and name the test that proves it. -->

- [ ] AC1 — covered by `path/to/test`

## Tests

- [ ] Unit tests added/updated
- [ ] API tests added/updated (OpenRouter mocked)
- [ ] Maestro flow added/updated (for main user flows)
- [ ] Lint, typecheck and tests pass locally for every app touched

## Checklist

- [ ] Money handled as integer VND (no floats)
- [ ] New tables/fields: UUID id, `created_at`, `updated_at`, `deleted_at`
- [ ] No secrets, no `.env`, no edits to `docs/`, `tests/golden/` or `.github/workflows/`
- [ ] Real-device checks needed (deeplink / camera / speech): <!-- list or "none" -->

## Risks / notes for review
