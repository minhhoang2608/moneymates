#!/usr/bin/env bash
# Shared helpers for factory workflow scripts.
# Requires: gh, jq, and env GH_TOKEN + GH_REPO (owner/repo). Source it, do not execute it.
# shellcheck shell=bash

set -euo pipefail

: "${GH_REPO:?GH_REPO must be set (owner/repo)}"

# Used by the scripts that source this file.
# shellcheck disable=SC2034
ACTIVE_DEV_STATUSES="status:in-progress status:review status:changes-requested status:needs-rebase"
# shellcheck disable=SC2034
DEV_ROLES="dev-fe dev-be dev-fullstack"
RESULT_FILE="${RESULT_FILE:-.factory/result.json}"
RUN_URL="${GITHUB_SERVER_URL:-https://github.com}/${GH_REPO}/actions/runs/${GITHUB_RUN_ID:-0}"

log() { echo "[factory] $*" >&2; }
notice() { echo "::notice::$*"; }

# Write key=value to $GITHUB_OUTPUT (or stdout when run locally).
set_output() {
  if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
    echo "$1=$2" >>"$GITHUB_OUTPUT"
  else
    echo "$1=$2"
  fi
}

summary() {
  if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
    echo "$*" >>"$GITHUB_STEP_SUMMARY"
  fi
  log "$*"
}

is_in_list() { # is_in_list <word> <space separated list>
  local w
  for w in $2; do [[ "$w" == "$1" ]] && return 0; done
  return 1
}

# ---------- labels ----------

issue_labels() { gh issue view "$1" --json labels --jq '.labels[].name'; }

has_label() { issue_labels "$1" | grep -qxF -- "$2"; }

issue_state() { gh issue view "$1" --json state --jq '.state'; }

current_status() { issue_labels "$1" | grep -E '^status:' | head -n1 || true; }

# Replace every status:* label with exactly one new status.
set_status() {
  local issue="$1" new="$2" l
  local -a args=(--add-label "$new")
  while IFS= read -r l; do
    [[ -z "$l" ]] && continue
    if [[ "$l" == status:* && "$l" != "$new" ]]; then args+=(--remove-label "$l"); fi
  done < <(issue_labels "$issue")
  gh issue edit "$issue" "${args[@]}" >/dev/null
  log "#$issue -> $new"
}

clear_status() {
  local issue="$1" l
  local -a args=()
  while IFS= read -r l; do
    [[ "$l" == status:* ]] && args+=(--remove-label "$l")
  done < <(issue_labels "$issue")
  if ((${#args[@]} > 0)); then gh issue edit "$issue" "${args[@]}" >/dev/null; fi
}

role_of_issue() { issue_labels "$1" | sed -n 's/^agent://p' | head -n1; }

# ---------- comments / counters ----------

comment() { gh issue comment "$1" --body "$2" >/dev/null; }

counter_marker() { printf '<!-- factory:counter %s -->' "$1"; }

# Number of times counter <name> was incremented on issue/PR <n>.
counter_get() {
  local marker
  marker="$(counter_marker "$2")"
  gh api --paginate "repos/$GH_REPO/issues/$1/comments?per_page=100" \
    --jq ".[] | select(.body | contains(\"$marker\")) | .id" | wc -l | tr -d ' '
}

# Increment counter <name> on issue <n> with a visible message; prints the new value.
counter_inc() {
  comment "$1" "$(counter_marker "$2")
$3"
  counter_get "$1" "$2"
}

escalate() {
  local issue="$1" reason="$2"
  gh issue edit "$issue" --add-label needs-human >/dev/null
  comment "$issue" "<!-- factory:escalation -->
:raising_hand: **Needs human.** $reason

The factory skips this ticket until the \`needs-human\` label is removed. ([run]($RUN_URL))"
  notice "#$issue escalated to needs-human: $reason"
  # A Dev holding this ticket is free again (busy tickets exclude needs-human): give it the next one now.
  if [[ -n "$(role_of_issue "$issue")" ]]; then kick_assign; fi
}

# Called when an agent run failed (not paused). Counts failures and escalates past the limit.
record_failure() {
  local issue="$1" what="$2" n
  n="$(counter_inc "$issue" failure ":warning: $what failed without a valid result ([run]($RUN_URL)).")"
  if ((n > ${MAX_AGENT_FAILURES:-2})); then
    escalate "$issue" "$what failed $n times (limit MAX_AGENT_FAILURES=${MAX_AGENT_FAILURES:-2})."
  fi
}

# ---------- branches / PRs ----------

# feat/12-slug or fix/12-slug -> 12
issue_from_branch() {
  if [[ "$1" =~ ^(feat|fix)/([0-9]+)(-|$) ]]; then echo "${BASH_REMATCH[2]}"; fi
}

# Open PR into dev for an issue, by branch naming convention.
pr_for_issue() {
  gh pr list --state open --base dev --json number,headRefName --limit 100 \
    --jq ".[] | select(.headRefName | test(\"^(feat|fix)/$1(-|$)\")) | .number" | head -n1
}

set_commit_status() { # sha state description
  gh api -X POST "repos/$GH_REPO/statuses/$1" \
    -f state="$2" -f context=tech-lead-review -f description="$3" -f target_url="$RUN_URL" >/dev/null
}

tech_lead_status() { # sha -> success|failure|pending|""
  gh api "repos/$GH_REPO/commits/$1/status" \
    --jq '[.statuses[] | select(.context=="tech-lead-review")][0].state // ""'
}

# ---------- workflows ----------

# Explicit hand-off: events created with GITHUB_TOKEN do not start workflows,
# but workflow_dispatch does. Usage: dispatch <workflow.yml> [-f key=value ...]
dispatch() {
  local wf="$1"
  shift
  gh workflow run "$wf" --ref "${FACTORY_REF:-dev}" "$@"
  log "dispatched $wf $*"
}

# Display titles of runs of <workflow.yml> that are queued or running.
active_runs() {
  gh run list --workflow "$1" --limit 50 --json status,displayTitle \
    --jq '.[] | select(.status != "completed") | .displayTitle'
}

# ---------- tickets ----------

# Issue numbers referenced as dependencies in a body: "Depends on #12", "Blocked by #3, #4".
deps_of_body() {
  grep -iE '(depends on|blocked by)' <<<"$1" | grep -oE '#[0-9]+' | tr -d '#' | sort -u || true
}

# A dependency is satisfied once it is merged into dev (status:testing / status:done) or closed.
dep_satisfied() {
  local info
  info="$(gh issue view "$1" --json state,labels --jq '[.state] + [.labels[].name] | join(" ")' 2>/dev/null || echo MISSING)"
  [[ "$info" == CLOSED* || "$info" == *status:testing* || "$info" == *status:done* ]]
}

# Sub-tickets recorded on a parent feature by triage (<!-- factory:children 12 13 -->).
children_of() {
  gh api --paginate "repos/$GH_REPO/issues/$1/comments?per_page=100" \
    --jq '.[].body | capture("<!-- factory:children (?<c>[0-9 ]+) -->")? | .c' | tr ' ' '\n' | grep -E '^[0-9]+$' | sort -u || true
}

# Parent features (type:epic) whose sub-tickets are all closed: ready for end-to-end verification.
completed_parents() {
  local p c kids open
  for p in $(gh issue list --state open --label type:epic --limit 100 --json number,labels \
    --jq '.[] | select([.labels[].name] | index("needs-human") | not) | .number'); do
    kids="$(children_of "$p")"
    [[ -z "$kids" ]] && continue
    open=false
    for c in $kids; do
      if [[ "$(issue_state "$c" 2>/dev/null || echo CLOSED)" == OPEN ]]; then open=true; break; fi
    done
    # if, not "[[ ]] && echo": a false last test would make the function (and, under set -e, the caller) fail.
    if [[ "$open" == false ]]; then echo "$p"; fi
  done
}

# Tickets to verify: status:testing tickets plus completed parent features,
# minus those blocked by an open bug the Tester filed.
testing_candidates() {
  local n bugs b blocked
  while IFS= read -r n; do
    [[ -z "$n" ]] && continue
    blocked=false
    bugs="$(gh api --paginate "repos/$GH_REPO/issues/$n/comments?per_page=100" \
      --jq '.[].body | capture("<!-- factory:blocking-bug (?<n>[0-9]+) -->")? | .n' || true)"
    for b in $bugs; do
      if [[ "$(issue_state "$b" 2>/dev/null || echo CLOSED)" == OPEN ]]; then blocked=true; fi
    done
    if [[ "$blocked" == false ]]; then echo "$n"; fi
  done < <(
    gh issue list --state open --label status:testing --limit 100 --json number,labels \
      --jq '.[] | select([.labels[].name] | index("needs-human") | not) | .number'
    completed_parents
  )
}

# Merge commit (on dev) of the merged PR of ticket <n>; empty when none is found.
merge_commit_of_issue() {
  gh pr list --state merged --base dev --limit 100 --json mergeCommit,headRefName     --jq ".[] | select(.headRefName | test(\"^(feat|fix)/$1(-|$)\")) | .mergeCommit.oid" | head -n1
}

# Start an E2E run unless one is already queued or running (it re-triggers the Tester when it finishes).
kick_e2e() {
  local active
  active="$(gh run list --workflow e2e.yml --limit 20 --json status --jq '[.[] | select(.status != "completed")] | length')"
  if [[ "$active" == 0 ]]; then
    dispatch e2e.yml || log "could not dispatch e2e.yml"
  else
    log "E2E already queued or running"
  fi
}

# Read a field from the agent result file.
result_get() { jq -r "$1 // empty" "$RESULT_FILE"; }

# PR title, body, conversation and reviews as markdown. Uses REST-backed JSON fields on purpose:
# `gh pr view --comments` also queries the check rollup over GraphQL, which needs `checks: read`
# that the agent jobs do not have.
pr_conversation() {
  gh pr view "$1" --json title,body,author,comments,reviews --jq '
    "# PR #'"$1"': \(.title)\n\n**Author:** \(.author.login)\n\n\(.body)\n",
    (.comments[] | "\n---\n**\(.author.login)** (\(.createdAt)):\n\n\(.body)"),
    (.reviews[] | select(.body != "") | "\n---\n**\(.author.login)** review (\(.state)):\n\n\(.body)")'
}

# Continuous assignment: ask the Tech Lead to assign right away instead of waiting for the 30-minute
# sweep. Call it whenever a Dev is freed (merge, escalation) or new tickets become ready. The assign
# workflow only calls Claude when an idle Dev has a compatible ticket, and a pending run is collapsed
# by its concurrency group, so extra kicks are cheap. Never fails the caller.
kick_assign() {
  dispatch tech-lead-assign.yml || log "could not dispatch tech-lead-assign.yml"
}
