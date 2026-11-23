# MoneyMates – AI software factory: setup and operations

This is the **human** checklist. The process itself is described in `docs/ai-software-factory.md`, and the agent rules in `CLAUDE.md`.

## How it fits together

```text
docs/ push ─► BA: feature tickets ─► Tech Lead triage: split each feature into FE / BE / infra sub-tickets
                (user-facing, no area)        (feature becomes a parent; sub-tickets → status:ready)
                                                             │
              (every 30 min, + resume sweep) Tech Lead assign ─► Dev FE / BE / Fullstack ─► PR ─► CI (ci-gate)
                                                                                                │
          Tester ◄── merge (status:testing) ◄── Tech Lead review (commit status tech-lead-review)
            │  sub-ticket verified → closed;          │ changes / CI red / conflict
            │  all sub-tickets closed → parent         └──────────────► Dev
            │  feature verified end to end → closed
            └─ bug (status:triage)
```

- **Identity and auth:** every agent runs through `anthropics/claude-code-action@v1`, authenticated with your **Claude Pro** subscription (`CLAUDE_CODE_OAUTH_TOKEN`, no API key). Claude acts on GitHub as the Claude GitHub App.
- **Hand-offs:** state changes (labels, commit status, merge, closing) are made by workflow scripts with `GITHUB_TOKEN`. GitHub doesn't start workflows for `GITHUB_TOKEN` events, so each script explicitly dispatches the next workflow (`workflow_dispatch` is exempt from that rule). Dev pushes and PRs use the Claude App token, so they start CI by themselves. A resume sweep every 30 minutes catches anything that was missed.
- **Limits:** `.github/factory.env`.

## One-time setup

### 1. GitHub plan and repository settings

- [ ] **Rulesets and branch protection on a private repo need GitHub Pro, Team or Enterprise.** On GitHub Free, the factory still works (scripts only merge after green CI and an approving review), but nothing stops a manual merge. Upgrade, or accept that.
- [ ] Settings → General → **Default branch = `dev`** (already the case).
- [ ] Settings → General → Pull Requests: enable **Allow squash merging**, enable **Automatically delete head branches**. Merge commits and rebase merging can be disabled.
- [ ] Settings → Actions → General:
  - Actions permissions: *Allow all actions*, or *Allow select actions* with `actions/*`, `anthropics/claude-code-action@*`, `reactivecircus/android-emulator-runner@*`.
  - Workflow permissions: *Read repository contents* is enough, because every job declares its own permissions. **Leave** "Allow GitHub Actions to create and approve pull requests" **unchecked** (nothing needs it).
- [ ] Actions minutes: a private repo on Free gets 2,000 minutes/month. E2E on the Android emulator costs about 20–30 minutes per merge. Check Settings → Billing.

### 2. Claude GitHub App and token

- [ ] Install the Claude GitHub App on this repository: run `/install-github-app` in Claude Code, or go to <https://github.com/apps/claude>.
- [ ] Run `claude setup-token` on your machine (logged in with the Pro account) and copy the token.
- [ ] Settings → Secrets and variables → Actions → **Secrets** → `CLAUDE_CODE_OAUTH_TOKEN` = that token. **Do not** create `ANTHROPIC_API_KEY`.
- [ ] The token is long-lived but can expire or be revoked. If every agent run fails with an auth error, repeat this step.

### 3. Repository variable

- [ ] Settings → Secrets and variables → Actions → **Variables** → `FACTORY_ENABLED` = `false` for now.

### 4. Labels

```bash
gh auth login               # once
scripts/setup-labels.sh     # idempotent; re-run any time
```

### 5. Rulesets (Settings → Rules → Rulesets → New branch ruleset)

The required checks can only be picked from the list **after they have run once** in the repo (seen in the last 7 days). `ci-gate` appears after this setup PR runs CI. `tech-lead-review` appears after the first factory PR is reviewed. You can also type the name into the check search box.

**`dev` ruleset** (target: `dev`, enforcement: Active):

- [ ] Restrict deletions, Block force pushes.
- [ ] Require a pull request before merging: required approvals **0** (all agents share one identity, so the Tech Lead approves through a status check, not the Approve button).
- [ ] Require status checks to pass:
  - `ci-gate` (from GitHub Actions)
  - `tech-lead-review` (source: **any source**; it is a commit status set by the review workflow)
  - **Do not** enable "Require branches to be up to date". Conflicts are handled by `conflict-check.yml`, and the Tester verifies `dev` after each merge.
- [ ] Bypass list: **Repository admin – Always**, so that you can push `docs/` changes directly to `dev`.

**`main` ruleset** (target: `main`):

- [ ] Restrict deletions, Block force pushes, Require a pull request, Require status check `ci-gate`.
- [ ] Bypass list: Repository admin. Agents never target `main` (repo rules and Claude hooks).

### 6. Design references (done; keep in sync)

The logo (<https://claude.ai/artifact/2m2qR4FeFweAJzbk9sTkUr>) and UI mockup (<https://claude.ai/artifact/PxFxv62jrWscb7hbTVEAUu>) canvases need a claude.ai login, so agents in CI can't open them. Their source (HTML + CSS per screen, design tokens, logo and `icon.svg`) is exported to `docs/design/`, with `docs/design/README.md` as the index. **When you change the design on the canvas, re-export.** Ask your local Claude Code to "re-export the design canvases into docs/design" (with `FACTORY_HUMAN_OVERRIDE=1`), then push to `dev`.

### 7. Golden tests (`tests/golden/`)

A first set of canonical cases is in `tests/golden/` (money parsing, split, "Tôi thu hộ" settlement, stats, VietQR generate/parse). `tests/golden/README.md` describes the format. They were computed by a reference implementation and reviewed by a human. **Agents can't change them.**

- **Add real bank QR codes** (recommended): see "Adding real bank QR codes" in `tests/golden/README.md`.
- To change or add cases with your **local** Claude Code, start it with `FACTORY_HUMAN_OVERRIDE=1` in the environment. The override is ignored inside GitHub Actions.

## Start, stop, observe

| Action | How |
| --- | --- |
| **Start** | Merge this setup PR, run the labels script, set `FACTORY_ENABLED=true`, then Actions → **BA** → *Run workflow* (or push a change in `docs/`). |
| **Stop (emergency)** | Set `FACTORY_ENABLED=false`. Every agent workflow exits at its first job. Optionally cancel running runs: `gh run list --status in_progress` then `gh run cancel <id>`. |
| **Pause one ticket** | Add `needs-human`. Remove it to resume; the resume sweep picks it up within 30 minutes. |
| **Fewer parallel Devs** | Lower `MAX_PARALLEL_DEVS` in `.github/factory.env` (roles are enabled in `DEV_ROLES_PRIORITY` order). |
| **Change requirements** | Edit `docs/*.md` and push to `dev`. BA creates new tickets or comments on affected open ones. |
| **Release** | Manually: PR `dev` → `main`, merge, build with EAS, deploy Django to Hawk Host. |
| **Progress** | Issues filtered by `status:*` labels, or the weekly report. |

## Daily: the `needs-human` queue

Filter issues by `label:needs-human`. Each one has an escalation comment that says why:

- **Spec ambiguous / blocked:** answer in the issue (edit the acceptance criteria if needed) and remove `needs-human`.
- **Limit exceeded** (review rounds, CI-fix, rebase, failures): look at the PR, then fix it yourself, close it, or give the agent a fresh budget. Counters are hidden comments (`<!-- factory:counter review-round -->`). Delete those comments to reset a counter, then remove `needs-human`.
- **`test:real-device`:** install the latest `dev` build on your phone, check the listed items, then close the issue (add `status:done`) or open a bug.
- **Workflow change needed:** agents cannot edit `.github/workflows/`. Apply the change described in the PR yourself.

## Claude Pro usage limit

Agents share your Pro quota with claude.ai and local Claude Code. When the quota runs out, the run finishes **green with a "paused" warning**: labels and counters stay as they were and nothing is escalated. After the reset, the 30-minute resume sweep re-dispatches unfinished work. To spend less quota, lower `MAX_PARALLEL_DEVS` or `MAX_DEV_RUNS_PER_DAY`, or switch `MODEL_*` in `factory.env` (Opus is used for BA and Dev planning).

## Weekly report

Every Monday at 08:00 (Vietnam time), `weekly-report.yml` opens an issue labelled `report:weekly` and closes last week's:

- **Done:** tickets verified and closed in the last 7 days.
- **Blocked:** everything with `needs-human`. Work through this list first.
- **In progress:** tickets in in-progress, review, changes-requested, needs-rebase or testing, with their Dev.
- **Runs table:** runs per workflow (success, failure, cancelled) and approximate minutes. Many failures on one workflow usually mean an expired token or a broken prompt. Paused runs count as success; see each run's summary.

## Workflows

| Workflow | Trigger | What it does |
| --- | --- | --- |
| `ci.yml` | PR into dev, push to dev, dispatch, called by Tester | Lint, typecheck, tests for apps that exist, golden tests, actionlint + shellcheck. `ci-gate` is the required check. |
| `ba.yml` | push to `docs/**` on dev, dispatch | BA (Opus) creates missing user-facing feature tickets → triage |
| `tech-lead-triage.yml` | `status:triage` added by a human, dispatch | Triage batch: splits features into per-area sub-tickets → `status:ready` |
| `tech-lead-assign.yml` | every 30 min, dispatch | Resume sweep, then assign idle Devs |
| `dev.yml` (+ `_dev-agent.yml`) | dispatch, or a human adding `agent:*` / `status:changes-requested` / `status:needs-rebase` | Plan (Opus) → implement (Sonnet) → PR; one concurrency group per role |
| `tech-lead-review.yml` | CI completed on `feat/**` / `fix/**`, dispatch | CI red → back to Dev. Green → review → status + merge. |
| `conflict-check.yml` | push to dev, dispatch | Conflicting PRs → `status:needs-rebase` → Dev |
| `tester.yml` | push to dev, dispatch | Tests + E2E (Android emulator, Maestro) → verify ACs → close or file bugs |
| `weekly-report.yml` | Monday 01:00 UTC, dispatch | Weekly report issue (no Claude) |

## Claude Code hooks (`.claude/settings.json`)

They apply to every Claude Code session in this repo: the agents in CI and your local sessions.

| Hook | Event | Effect |
| --- | --- | --- |
| `guard-paths.mjs` | PreToolUse on Read / Edit / Write / MultiEdit / NotebookEdit | Blocks reading or writing `.env*` (except `.env.example` / `.env.sample`), `secrets/`, keys, keystores. Blocks writing `docs/**` and `tests/golden/**` (local override `FACTORY_HUMAN_OVERRIDE=1`, ignored in CI). In CI it also blocks writing `.github/workflows/**` and `.claude/**`. |
| `guard-bash.mjs` | PreToolUse on Bash | Blocks `git push` to `dev`/`main`, `--force` / `-f` / `+refspec`, `--force-with-lease` outside `feat/*` / `fix/*`, deleting remote branches, pushing other branches in CI. Also blocks `gh pr merge`, PRs into `main`, shell reads of `.env` and secret variables (`printenv`, `env`, `$…TOKEN`), and shell writes into `docs/` or `tests/golden/`. |
| `format-on-edit.mjs` | PostToolUse on Edit / Write / MultiEdit | Runs the formatter or linter for the edited file when the tool is installed: Prettier + ESLint `--fix` (ts/tsx/js/jsx/json/css in `apps/mobile`), `ruff format` + `ruff check --fix` (py), `shellcheck` (sh). Remaining lint errors are fed back to Claude. Nothing happens when the tool is missing. |

`permissions.deny` in the same file blocks `.env` and secret reads as a second layer.

## Troubleshooting

- **Nothing happens after a label change:** labels added by workflows don't start workflows (that's by design). Check that the previous run dispatched the next one. Otherwise the resume sweep will.
- **Agent run fails at "Run Claude" with an OIDC or app error:** the Claude GitHub App is missing from the repo, or the workflow file on the PR branch differs from `dev`. Agent workflows only work from files merged into `dev`.
- **Two events for the same Dev at once:** GitHub keeps at most one pending run per concurrency group and cancels older pending ones. The resume sweep re-dispatches anything that got dropped.
