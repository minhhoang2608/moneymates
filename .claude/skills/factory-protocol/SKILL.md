---
name: factory-protocol
description: How factory agents hand off work – the label state machine, the .factory/result.json contract per agent, counters and limits, usage-limit pauses, and which side (agent vs workflow script) does what. Load in every factory run.
---

# Factory protocol

## Who does what

| Agent (Claude)                                                          | Workflow scripts (`scripts/factory/*.sh`, GITHUB_TOKEN)                            |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Reads inputs in `.factory/`, the repo and `gh` (read)                   | Collect inputs into `.factory/input.json` etc.                                     |
| Code, branches, pushes, PRs (Dev only, with the Claude App token)       | Set `status:*`, `agent:*`, `needs-human`, and the commit status `tech-lead-review` |
| Creates or edits ticket text and type/priority/area labels (BA, Triage) | Merge PRs, close issues, open Tester bugs                                          |
| Writes **`.factory/result.json`**                                       | Count attempts and escalate past limits; dispatch the next workflow                |

GitHub doesn't start workflows for events made with `GITHUB_TOKEN`, so scripts hand off with `gh workflow run` (workflow_dispatch). Assignment is event-driven too: a merge, an escalation or newly ready tickets call `kick_assign`, so a freed Dev gets its next ticket within minutes. The 30-minute cron is only a safety net. Dev pushes and PRs made with the Claude App token start CI by themselves.

## Result file contract

Always write valid JSON to `.factory/result.json` as the **last** step. A missing or invalid file counts as a failed run.

| Run           | Shape                                                                                                                              |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| BA            | `{"created":[N],"commented":[N],"more":true,"notes":"..."}` (`more: true` starts another BA run)                                   |
| Triage        | `{"issues":[{"number":N,"decision":"ready\|split\|epic\|duplicate\|needs_human","reason":"...","children":[N],"duplicate_of":N}]}` |
| Assign        | `{"assignments":[{"issue":N,"role":"dev-fe\|dev-be\|dev-fullstack","reason":"..."}]}`                                              |
| Dev plan      | `{"outcome":"planned"}` or `{"outcome":"blocked","reason":"..."}`, plus `.factory/plan.md`                                         |
| Dev implement | `{"outcome":"pr_opened\|pushed\|no_changes\|blocked","pr":N,"summary":"...","reason":"..."}`                                       |
| Review        | `{"verdict":"approve\|changes_requested\|needs_human","body":"markdown"}`                                                          |
| BA verify     | same shape as Tester (`results`), written for parent features; the BA verifies them end to end                                     |
| Tester        | `{"results":[{"issue":N,"verdict":"pass\|fail\|real_device","notes":"...","bug":{...}}]}`                                          |

## State machine (one `status:*` per issue)

`triage → ready → in-progress → review → (changes-requested | needs-rebase → review)* → testing → done`

- BA creates **feature** tickets (user-facing, no `area:*`). Tech Lead triage splits each one into **sub-tickets** per Dev area (`Parent: #n`). The feature becomes a parent (`type:epic`, no status, never assigned), and the triage script records its children in a `<!-- factory:children … -->` comment.
- When every sub-ticket of a parent is closed, the parent becomes a Tester candidate and is verified end to end.
- A ticket's PR is found through its branch `feat/<n>-…` / `fix/<n>-…`. PR bodies say `Refs #n`.
- `needs-human` freezes a ticket: every workflow skips it until a human removes the label.

## Limits (`.github/factory.env`)

Counters are hidden comment markers on the issue (`<!-- factory:counter <name> -->`). Exceeding a limit adds `needs-human`:

- `review-round` > `MAX_REVIEW_ROUNDS`
- `ci-fix` > `MAX_CI_FIX_ATTEMPTS`
- `rebase` > `MAX_REBASE_ATTEMPTS`
- `failure` > `MAX_AGENT_FAILURES` (a crash, max turns, or no valid result)

`MAX_DEV_RUNS_PER_DAY` only delays work until the next day. `MAX_BA_ISSUES_PER_RUN` caps BA output.

## Usage-limit pause

If the Claude Pro usage limit is hit, the run is classified **paused**. No labels change, no counter goes up, and nothing gets `needs-human`. Every 30 minutes the resume sweep in `tech-lead-assign.yml` re-dispatches tickets that are mid-flow and have no active run. Because of that:

- **Push early (Dev):** commit and push your branch regularly, so a resumed run can continue from `origin`.
- Make every step idempotent. A resumed run must check what already exists (branch, PR, plan comment, child tickets) before creating it again.
