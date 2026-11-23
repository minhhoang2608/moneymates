# MoneyMates – rules for every agent

MoneyMates is an iOS/Android expense tracker for Vietnamese users. You can log a payment by scanning a VietQR code and handing off to a bank/wallet app, by typing it, by voice, or by photographing a bill. It also tracks group trip expenses, splits them, and settles them "Tôi thu hộ" style (everyone pays or receives only from "me", each with a VietQR code). v1 is **local-first and offline**: the data lives in SQLite on the phone. The only server is a small Django API that holds the OpenRouter key for the AI endpoints. There is no login, sync or backup in v1.

The project is built by an AI software factory. Read the source documents before you plan anything:

| Document | Content |
| --- | --- |
| `docs/plan-chuc-nang-giao-dien.md` | Product requirements, screens, data model (Vietnamese) |
| `docs/tech-stack.md` | Technical decisions (Vietnamese) |
| `docs/ai-software-factory.md` | How the factory works (Vietnamese) |
| `docs/factory-setup.md` | Human setup checklist |

`docs/` is **human-owned input**. Agents read it and never edit it.

**Design references:**

- Logo: <https://claude.ai/artifact/2m2qR4FeFweAJzbk9sTkUr#artboard-15dd8cd198dd> ("Hai đồng xu" with a `$`).
- UI mockup (19 screens): <https://claude.ai/artifact/PxFxv62jrWscb7hbTVEAUu#page-dcb81aee8d83>.

These links need a claude.ai login, so agents in CI can't open them. **Use the exports in `docs/design/` instead:** `docs/design/README.md` maps the 19 screens to files and holds the design tokens (colours, type, radii, tab bar). `docs/design/screens/*.dc.html` holds each screen's real HTML and CSS, and `docs/design/logo/` holds the chosen logo and `icon.svg`. Never invent branding. If a UI ticket depends on a visual detail that isn't there, report `blocked`.

## Repository layout

```text
apps/mobile/     Expo (React Native, TypeScript, expo-router, expo-sqlite + Drizzle, Zustand, TanStack Query)
apps/api/        Django + DRF (Python 3.12), endpoints /ai/parse-text, /ai/parse-bill, /me/features
tests/golden/    Golden fixtures for money logic – READ-ONLY for agents
docs/            Human-owned requirements – READ-ONLY for agents
.claude/         Agent definitions, skills, hooks, settings
.github/         Workflows, factory limits (factory.env), templates
scripts/         setup-labels.sh, factory/*.sh (workflow helpers)
```

`apps/mobile` and `apps/api` are created by factory tickets, not by hand. Each app must expose these commands, because CI calls them:

- `apps/mobile`: `npm ci`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:golden` (runs `tests/golden/` fixtures), Maestro flows in `apps/mobile/.maestro/`.
- `apps/api`: `pip install -r requirements-dev.txt`, `ruff check .`, `ruff format --check .`, `pytest`.

## Branches

- `dev`: default and integration branch. Every PR targets `dev`. Tester tests only `dev`.
- `main`: releases, **human-only**. Agents never push to `main`, open PRs into it, or merge into it.
- Work branches: `feat/<issue>-<slug>` and `fix/<issue>-<slug>`, for example `feat/12-vietqr-parser`. The issue number in the branch name is how workflows link a PR to its ticket.
- Never push to `dev` directly. Rewrite history only on your own work branch, and only with `git push --force-with-lease`.
- PR bodies use `Refs #<issue>`, **never** `Closes`/`Fixes`, because the Tester closes tickets after verifying them on `dev`.

## Label state machine

Each issue carries **exactly one** `status:*` label. Workflow scripts (`scripts/factory/`) move tickets between statuses. **Agents do not add or remove `status:*`, `agent:*` or `needs-human` labels themselves.** They report what happened in `.factory/result.json` (see the `factory-protocol` skill).

```text
BA feature (user-facing, no area) ── status:triage
        │ Tech Lead triage splits it by Dev area
        ├─► parent feature: type:epic, no status, never assigned
        └─► sub-tickets (area:mobile / area:api / area:infra / both) ── status:ready
                 │ (agent:dev-* assigned)
                 ▼
           status:in-progress → status:review ⇄ status:changes-requested / status:needs-rebase
                 │ merge into dev
                 ▼
           status:testing → status:done (closed by Tester)   ── fail → new type:bug (status:triage)
All sub-tickets closed → Tester verifies the parent feature end to end → closed (status:done)
```

| Label | Meaning |
| --- | --- |
| `status:triage` | New ticket, waiting for Tech Lead |
| `status:ready` | Triaged, waiting for assignment |
| `status:in-progress` | A Dev is working on it |
| `status:review` | PR open, waiting for Tech Lead review |
| `status:changes-requested` | Tech Lead (or CI) asked for changes |
| `status:needs-rebase` | PR conflicts with `dev` |
| `status:testing` | Merged into `dev`, waiting for Tester |
| `status:done` | Verified on `dev`, closed |
| `agent:dev-fe` / `agent:dev-be` / `agent:dev-fullstack` | Which Dev owns the ticket |
| `needs-human` | Stuck: every agent skips it until a human removes the label |
| `test:real-device` | Needs a check on a physical phone (paired with `needs-human`) |
| `type:feature` / `type:bug` / `type:chore` | Ticket type |
| `type:epic` | Parent feature split into sub-tickets by the Tech Lead. Never assigned; verified end to end when all sub-tickets are closed |
| `priority:p0`…`priority:p3` | p0 is highest |
| `area:mobile` / `area:api` / `area:infra` | Code area, set by the **Tech Lead** (BA features have none). FE takes mobile, BE takes api, Fullstack takes both, infra and overflow |

## Engineering rules

- **Money is an integer number of VND** (`number` in TS, `int`/`BigIntegerField` in Python), always stored with `currency`. Never use floats for money. Rounding and remainder rules live in the `money-logic` skill.
- **Sync-ready schema from day one:** UUID primary keys generated on the device; `created_at`, `updated_at` (UTC) and `deleted_at` (soft delete) on every table; nullable `owner_id`; table and field names identical in Drizzle and Django.
- **No secrets in code or in the app.** Keys live only in GitHub secrets and in server environment variables. Commit `.env.example` with placeholders. Never read, print or commit `.env` files or tokens.
- **The mobile app never talks to a database or third-party AI directly.** Everything goes through the Django API.
- **Every change ships with tests.** Use unit tests for logic, API tests for endpoints (mock OpenRouter, never call it), and a Maestro flow for any new main user flow. See the `testing-strategy` skill.
- **`tests/golden/` is read-only for agents.** If a golden case looks wrong, stop and report `blocked`. Never change the fixture to make code pass.
- Keep each PR to one ticket. Make no drive-by refactors. Follow the existing style. The lint and format hooks run automatically after edits.
- Write tickets, PRs, commits, code and comments in English. User-facing UI strings are Vietnamese.
- Use Conventional Commit messages that mention the issue, for example `feat(mobile): parse VietQR payload (#12)`.

## Definition of Done (a ticket can only reach `status:done` if)

1. Every acceptance criterion in the issue is implemented and checked off in the PR.
2. Lint, typecheck and all unit, API and golden tests pass in CI (`ci-gate` is green).
3. New or changed behaviour has tests. Main user flows have a Maestro flow.
4. Tech Lead set `tech-lead-review` to green and merged into `dev`.
5. Tester verified the acceptance criteria on `dev`. Anything that only a physical phone can verify is flagged `test:real-device` for a human.
6. There are no secrets, no TODOs without a linked issue, and no edits to `docs/` or `tests/golden/`.

## Escalation (`needs-human`)

Escalate by reporting `"outcome": "blocked"` with a clear reason in `.factory/result.json`; the workflow adds `needs-human`. Do this when:

- The spec is ambiguous or contradicts `docs/`, or a golden test seems wrong.
- The change needs secrets, paid services, store accounts, or edits to `.github/workflows/` (agents have no permission for those).
- Something can only be verified on a real phone (bank deeplinks, camera scanning, Vietnamese speech recognition).

Workflows also escalate automatically when a limit in `.github/factory.env` is exceeded (review rounds, CI-fix attempts, rebase attempts, repeated agent failures). A Claude **usage-limit** error is not a failure: the run counts as paused and resumes after the limit resets.
