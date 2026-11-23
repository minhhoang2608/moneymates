---
name: pr-review-checklist
description: What the Tech Lead checks when reviewing a factory PR into dev – acceptance criteria coverage, tests, money and schema rules, security, scope – and how to write the verdict. Load in review mode.
---

# PR review checklist

Work through it in order. **Blocking** items mean `changes_requested`. Advisory items go in the body but don't block.

## 1. Ticket fit (blocking)

- [ ] PR body has `Refs #<n>` (not `Closes`), base `dev`, branch `feat|fix/<n>-…`.
- [ ] **Every acceptance criterion is implemented.** Map each AC to the code that implements it.
- [ ] **Every acceptance criterion is proven by a test** that asserts the actual behaviour (not just "renders"). Main user flows have a Maestro flow.
- [ ] Nothing out of scope: no unrelated refactors, no features that aren't in the ticket.

## 2. Correctness (blocking)

- [ ] Money is integer VND end to end: no `float`, no `parseFloat` on amounts, no `toFixed` for storage. Split and settlement totals add up exactly (see `money-logic`).
- [ ] VietQR changes respect TLV lengths and CRC16 (see `vietqr`). Parser handles missing optional tags.
- [ ] Edge cases from the docs: missing amount in QR, AI failure or quota → manual form with "Khác", member with transactions can't be deleted, "Tôi" can't be deleted, ended groups sort last.
- [ ] Error handling: no swallowed errors; user-visible failures have a Vietnamese message.

## 3. Data and schema (blocking)

- [ ] New tables and fields: UUID ids generated on the device, `created_at`/`updated_at` (UTC), `deleted_at` soft delete, nullable `owner_id` for personal data, `group_id` for group data.
- [ ] Names match between Drizzle and Django. Migrations are included and are forward-only.
- [ ] Queries exclude soft-deleted rows. Updates bump `updated_at`.

## 4. Security and privacy (blocking)

- [ ] No secrets, tokens, keys or `.env` files. New env vars appear in `.env.example` with placeholders.
- [ ] The app never calls OpenRouter or a database directly. AI goes through `/ai/*`, and API endpoints enforce the request limit.
- [ ] Tests mock external services. No real network calls in tests.
- [ ] No edits to `docs/`, `tests/golden/`, `.github/workflows/` or `.claude/`.
- [ ] No AI attribution: no `Co-Authored-By:` in commits, no "Generated with Claude Code" in the PR description.

## 5. Quality (advisory unless severe)

- Readable names, small functions, pure logic separated from UI and IO.
- Follows `mobile-conventions` / `api-conventions` structure.
- No dead code, debug logs, or TODOs without a linked issue.
- Real-device checks listed in the PR when deeplinks, camera or speech are touched.

## Writing the verdict

- `approve`: one short paragraph on what was checked, then any advisory notes.
- `changes_requested`: a numbered list. Each item has `path:line`, the problem, and what done looks like. Re-check the previous round's items first, and say which are resolved. Don't add new nitpicks in later rounds unless they're bugs.
- `needs_human`: only for a product or spec question. State the exact question and the options.
