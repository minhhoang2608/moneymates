#!/usr/bin/env bash
# Dev workflow helpers.
#   dev.sh route        - decide issue/role/reason for this run (outputs: run, issue, role, reason)
#   dev.sh start        - mark the run on the issue (daily-run marker, status:in-progress for new work)
#   dev.sh plan-fetch   - reuse an existing plan comment (outputs: has_plan)
#   dev.sh plan-apply   - post the Opus plan as an issue comment / escalate if blocked
#   dev.sh apply        - apply the implementation result (status:review, PR labels, hand-off)
# shellcheck source=scripts/factory/lib.sh
source "$(dirname "$0")/lib.sh"

cmd="${1:?command required}"
PLAN_FILE="${PLAN_FILE:-.factory/plan.md}"

route() {
  local issue="" role="" reason=""
  if [[ "${EVENT_NAME:-}" == "workflow_dispatch" ]]; then
    issue="${IN_ISSUE:-}"
    role="${IN_ROLE:-}"
    reason="${IN_REASON:-assigned}"
  else
    issue="${EVENT_ISSUE:-}"
    case "${LABEL:-}" in
      agent:dev-*) role="${LABEL#agent:}" reason=assigned ;;
      status:changes-requested) reason=changes-requested ;;
      status:needs-rebase) reason=rebase ;;
      *) set_output run false; return 0 ;;
    esac
  fi
  [[ -z "$role" && -n "$issue" ]] && role="$(role_of_issue "$issue")"

  if [[ -z "$issue" || -z "$role" ]] || ! is_in_list "$role" "$DEV_ROLES"; then
    notice "No valid issue/role (issue='$issue' role='$role'); skipping."
    set_output run false
    return 0
  fi
  if [[ "$(issue_state "$issue")" != OPEN ]] || has_label "$issue" needs-human; then
    notice "#$issue is closed or needs-human; skipping."
    set_output run false
    return 0
  fi

  local today runs
  today="$(date -u +%Y-%m-%dT00:00:00Z)"
  runs="$(gh api --paginate "repos/$GH_REPO/issues/comments?since=$today&per_page=100" \
    --jq ".[] | select(.body | contains(\"<!-- factory:dev-run $role -->\")) | .id" | wc -l | tr -d ' ')"
  if ((runs >= ${MAX_DEV_RUNS_PER_DAY:-8})); then
    notice "$role reached MAX_DEV_RUNS_PER_DAY=$MAX_DEV_RUNS_PER_DAY; the resume sweep retries tomorrow."
    set_output run false
    return 0
  fi

  set_output run true
  set_output issue "$issue"
  set_output role "$role"
  set_output reason "$reason"
  summary "Dev **$role** on #$issue (reason: $reason)"
}

start() {
  : "${ISSUE:?}" "${ROLE:?}" "${REASON:?}"
  comment "$ISSUE" "<!-- factory:dev-run $ROLE -->
:robot: **$ROLE** started (\`$REASON\`). [run]($RUN_URL)"
  if [[ "$REASON" == assigned ]]; then
    has_label "$ISSUE" "agent:$ROLE" || gh issue edit "$ISSUE" --add-label "agent:$ROLE" >/dev/null
    case "$(current_status "$ISSUE")" in
      status:ready | status:in-progress | "") set_status "$ISSUE" status:in-progress ;;
    esac
  fi
}

plan_fetch() {
  : "${ISSUE:?}"
  local body
  body="$(gh api --paginate "repos/$GH_REPO/issues/$ISSUE/comments?per_page=100" \
    --jq '[.[] | select(.body | contains("<!-- factory:plan -->"))] | last | .body // empty')"
  if [[ -n "$body" ]]; then
    mkdir -p "$(dirname "$PLAN_FILE")"
    printf '%s\n' "$body" >"$PLAN_FILE"
    set_output has_plan true
  else
    set_output has_plan false
  fi
}

plan_apply() {
  : "${ISSUE:?}" "${OUTCOME:?}"
  case "$OUTCOME" in
    paused) return 0 ;;
    failed) record_failure "$ISSUE" "Dev planning"; exit 1 ;;
  esac
  local outcome
  outcome="$(result_get .outcome)"
  if [[ "$outcome" == blocked ]]; then
    escalate "$ISSUE" "Dev could not plan: $(result_get .reason)"
    set_output proceed false
    return 0
  fi
  if [[ ! -s "$PLAN_FILE" ]]; then
    record_failure "$ISSUE" "Dev planning (no plan file)"
    exit 1
  fi
  comment "$ISSUE" "<!-- factory:plan -->
### Implementation plan
$(cat "$PLAN_FILE")"
  set_output proceed true
}

apply() {
  : "${ISSUE:?}" "${ROLE:?}" "${REASON:?}" "${OUTCOME:?}"
  case "$OUTCOME" in
    paused) return 0 ;;
    failed) record_failure "$ISSUE" "Dev ($ROLE, $REASON)"; exit 1 ;;
  esac

  local outcome pr summary_text
  outcome="$(result_get .outcome)"
  summary_text="$(result_get .summary)"
  case "$outcome" in
    blocked)
      escalate "$ISSUE" "Dev ($ROLE) is blocked: $(result_get .reason)"
      return 0
      ;;
    pr_opened | pushed | no_changes) ;;
    *)
      record_failure "$ISSUE" "Dev ($ROLE): unknown outcome '$outcome'"
      exit 1
      ;;
  esac

  pr="$(result_get .pr)"
  [[ -z "$pr" ]] && pr="$(pr_for_issue "$ISSUE")"
  if [[ -z "$pr" ]]; then
    record_failure "$ISSUE" "Dev ($ROLE): reported '$outcome' but no open PR was found"
    exit 1
  fi
  gh pr edit "$pr" --add-label "agent:$ROLE" >/dev/null || true
  set_status "$ISSUE" status:review
  [[ -n "$summary_text" ]] && comment "$ISSUE" ":white_check_mark: **$ROLE** ($REASON): $summary_text — PR #$pr"

  # A push by the Claude App starts CI (and then review) by itself. With nothing pushed,
  # nothing would start, so hand off to the review explicitly.
  if [[ "$outcome" == no_changes ]]; then
    dispatch tech-lead-review.yml -f pr="$pr"
  fi
}

# Save PR context for the agent: latest review feedback and, after a CI failure, the failed log.
# The Claude App token cannot read Actions logs, so this runs with GITHUB_TOKEN.
context() {
  : "${ISSUE:?}"
  mkdir -p .factory
  local pr run_id branch
  pr="$(pr_for_issue "$ISSUE")"
  set_output pr "$pr"
  [[ -z "$pr" ]] && return 0
  pr_conversation "$pr" >.factory/pr-conversation.md
  if [[ "${REASON:-}" == ci-failed ]]; then
    branch="$(gh pr view "$pr" --json headRefName --jq .headRefName)"
    run_id="$(gh run list --workflow ci.yml --branch "$branch" --limit 1 --json databaseId --jq '.[0].databaseId // empty')"
    if [[ -n "$run_id" ]]; then
      gh run view "$run_id" --log-failed 2>/dev/null | tail -n 400 >.factory/ci-failure.log || true
    fi
  fi
}

case "$cmd" in
  route) route ;;
  start) start ;;
  context) context ;;
  plan-fetch) plan_fetch ;;
  plan-apply) plan_apply ;;
  apply) apply ;;
  *) echo "unknown command $cmd" >&2; exit 2 ;;
esac
