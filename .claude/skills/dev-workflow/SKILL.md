---
name: dev-workflow
description: The shared workflow of the three Dev agents (dev-fe, dev-be, dev-fullstack) – planning run, implementation run per reason (assigned, changes-requested, ci-failed, rebase), allowed gh/git commands, label transitions, limits and result format.
---

# Dev workflow (FE / BE / Fullstack)

## Inputs

- Ticket: `gh issue view <n> --comments`. The acceptance criteria are the contract.
- `.factory/plan.md`: the approved plan (also posted on the issue as a `factory:plan` comment).
- `.factory/pr-conversation.md`: PR body and review rounds (read the **latest** Tech Lead review).
- `.factory/ci-failure.log`: the failed CI log, for `ci-failed`.
- `.factory/linked-run-logs.md`: the failed steps of the CI/E2E runs linked in the ticket. Read it first for a bug filed from a red run. Never report `blocked` because "the log cannot be read": the file is there, or fetch it with `gh run view <id> --log-failed`.
- `CLAUDE.md`, `docs/`, your agent file for scope, and the skills it names.

## Planning run (Opus, only for newly assigned tickets)

Write `.factory/plan.md` with no other file changes, about 60 lines at most:

1. Branch: `feat/<n>-<slug>`, or `fix/<n>-<slug>` for `type:bug`.
2. Files to add or change, and why.
3. Schema or data changes (sync-ready rules) and API contracts.
4. Tests: one or more per acceptance criterion (`AC1 → test name/file`), plus a Maestro flow if this is a main user flow.
5. Risks, assumptions, real-device checks.

Report `blocked` if the ticket is ambiguous, contradicts `docs/`, is clearly bigger than one PR, or needs secrets, paid services or `.github/workflows/` changes.

## Implementation run (Sonnet)

Shared setup: `git fetch origin`. If the branch exists on origin, `git checkout <branch>` (tracking origin). Otherwise create it with `git checkout -b <branch> origin/dev`.

| Reason              | Do                                                                                                                                                                                                                                                           |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `assigned`          | Implement the plan **with tests**. Make small Conventional Commits (`feat(mobile): … (#n)`, **no `Co-Authored-By:` trailer**) and `git push -u origin <branch>` regularly. When local checks pass, open the PR (below). If the PR already exists, just push. |
| `changes-requested` | Fix every numbered point of the latest review, then `gh pr comment <pr> --body-file <file>` with "Addressed: 1. …, 2. …". Push. If you disagree with a point, explain why in that comment and still report `pushed` (the reviewer decides).                  |
| `ci-failed`         | Read `.factory/ci-failure.log`, reproduce locally, fix the root cause (never skip or disable a test), push.                                                                                                                                                  |
| `rebase`            | Follow the `rebase-and-resolve-conflicts` skill.                                                                                                                                                                                                             |

Open the PR with:

```bash
gh pr create --base dev --head <branch> \
  --title "feat(mobile): <summary> (#<n>)" \
  --body-file .factory/pr-body.md   # based on .github/pull_request_template.md, with "Refs #<n>"
```

**Never write `Closes #n` / `Fixes #n`**: the Tester closes tickets.

## Before every push

Run lint, typecheck and tests for every app you touched (commands are in your agent file). Golden tests too, when `tests/golden/` has fixtures. Push only green code. If something is red and you can't fix it within your budget, push nothing broken, and report `blocked` with details.

## Allowed commands

- `gh issue view`, `gh issue comment`
- `gh pr create` (always `--base dev`), `gh pr view`, `gh pr diff`, `gh pr list`, `gh pr comment`
- `git` on your own `feat/*` / `fix/*` branch; `git push --force-with-lease` only after a rebase
- Package managers, test runners and linters inside `apps/`

**Forbidden** (hooks block most of these): pushing to `dev`/`main`, `--force`, `gh pr merge`, editing labels, editing `docs/`, `tests/golden/`, `.github/workflows/` or `.claude/`, reading `.env` or secrets, calling real external APIs from tests.

## Label transitions (applied by scripts from your result)

| Before                                             | Your outcome                | After                                                                  |
| -------------------------------------------------- | --------------------------- | ---------------------------------------------------------------------- |
| `status:in-progress`                               | `pr_opened` / `pushed`      | `status:review` (CI runs, then Tech Lead review)                       |
| `status:changes-requested` / `status:needs-rebase` | `pushed` / `no_changes`     | `status:review`                                                        |
| any                                                | `waiting` (with `blockers`) | `status:ready`, Dev freed, assigned again when the blockers are on dev |
| any                                                | `blocked`                   | `needs-human`                                                          |

## Result

`.factory/result.json`: `{"outcome":"pr_opened|pushed|no_changes|waiting|blocked","pr":N,"summary":"one line","reason":"when blocked or waiting","blockers":[N]}`

Report `waiting` (not `blocked`) when the ticket is fine but tickets it depends on are not merged into dev yet: list their issue numbers in `blockers`. No human is needed; the factory assigns the ticket again once they are on dev. Use `blocked` only when a human decision is needed.
