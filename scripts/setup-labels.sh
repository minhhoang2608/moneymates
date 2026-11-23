#!/usr/bin/env bash
# Creates or updates every label of the factory state machine. Idempotent: safe to run repeatedly.
# Usage: scripts/setup-labels.sh [owner/repo]   (defaults to the current repository)
# Requires: gh (authenticated with repo scope).
set -euo pipefail

repo_args=()
if [[ $# -ge 1 ]]; then repo_args=(--repo "$1"); fi

# name|color|description
labels=(
  "status:triage|FBCA04|New ticket, waiting for Tech Lead triage"
  "status:ready|0E8A16|Triaged, waiting for assignment"
  "status:in-progress|1D76DB|A Dev agent is working on it"
  "status:review|5319E7|PR open, waiting for Tech Lead review"
  "status:changes-requested|D93F0B|Tech Lead or CI requested changes"
  "status:needs-rebase|B60205|PR conflicts with dev, Dev must rebase"
  "status:testing|0052CC|Merged into dev, waiting for Tester"
  "status:done|C2E0C6|Verified on dev and closed"
  "agent:dev-fe|BFD4F2|Assigned to Dev FE (mobile)"
  "agent:dev-be|BFDADC|Assigned to Dev BE (API)"
  "agent:dev-fullstack|D4C5F9|Assigned to Dev Fullstack"
  "needs-human|E11D21|Agents are stuck; a human must act. Factory skips this ticket"
  "test:real-device|F9D0C4|Needs verification on a physical phone"
  "type:feature|A2EEEF|New functionality"
  "type:bug|D73A4A|Something is broken"
  "type:chore|EDEDED|Tooling, scaffolding, maintenance"
  "type:epic|3E4B9E|Parent feature split into sub-tickets; never assigned"
  "priority:p0|B60205|Highest priority"
  "priority:p1|D93F0B|High priority"
  "priority:p2|FBCA04|Normal priority"
  "priority:p3|C5DEF5|Low priority"
  "area:mobile|006B75|Expo app (apps/mobile)"
  "area:api|5319E7|Django API (apps/api)"
  "area:infra|444444|CI, tooling, scaffolding"
  "report:weekly|EDEDED|Weekly factory report"
)

for entry in "${labels[@]}"; do
  IFS='|' read -r name color description <<<"$entry"
  gh label create "$name" --color "$color" --description "$description" --force "${repo_args[@]}" >/dev/null
  echo "ok  $name"
done
echo "All ${#labels[@]} labels are in place."
