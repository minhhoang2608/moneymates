#!/usr/bin/env bash
# Tech Lead review helpers (tech-lead-review.yml).
#   review.sh route      - resolve PR/issue/sha/CI result (outputs: run, pr, issue, sha, branch, role, mode)
#                          mode = ci-failed | review | merge
#   review.sh ci-failed  - CI red: red status, count CI-fix attempt, send back to Dev
#   review.sh pending    - set tech-lead-review=pending while Claude reviews
#   review.sh apply      - apply Claude's verdict (merge or changes requested)
#   review.sh merge      - merge an approved PR and hand off to tester/conflict-check
# shellcheck source=scripts/factory/lib.sh
source "$(dirname "$0")/lib.sh"

cmd="${1:?command required}"

skip() { notice "$1"; set_output run false; exit 0; }

route() {
  local pr="" branch="" sha="" ci="" pr_json
  if [[ "${EVENT_NAME:-}" == workflow_run ]]; then
    branch="${WR_BRANCH:?}"
    pr="$(gh pr list --state open --base dev --head "$branch" --json number --jq '.[0].number // empty')"
    [[ -z "$pr" ]] && skip "No open PR into dev for $branch."
  else
    pr="${IN_PR:?}"
  fi

  pr_json="$(gh pr view "$pr" --json state,baseRefName,headRefName,headRefOid)"
  [[ "$(jq -r .state <<<"$pr_json")" == OPEN ]] || skip "PR #$pr is not open."
  [[ "$(jq -r .baseRefName <<<"$pr_json")" == dev ]] || skip "PR #$pr does not target dev."
  branch="$(jq -r .headRefName <<<"$pr_json")"
  sha="$(jq -r .headRefOid <<<"$pr_json")"

  if [[ "${EVENT_NAME:-}" == workflow_run ]]; then
    [[ "${WR_SHA:-}" == "$sha" ]] || skip "CI result is for an outdated commit of PR #$pr."
    ci="${WR_CONCLUSION:-}"
  else
    ci="$(gh run list --workflow ci.yml --commit "$sha" --limit 1 --json status,conclusion \
      --jq '.[0] | if . == null then "missing" elif .status != "completed" then "running" else .conclusion end')"
  fi

  local issue role
  issue="$(issue_from_branch "$branch")"
  [[ -z "$issue" ]] && skip "Branch $branch does not follow feat/<n>-slug; not a factory PR."
  has_label "$issue" needs-human && skip "#$issue is needs-human."
  role="$(role_of_issue "$issue")"

  local mode
  case "$ci" in
    success)
      if [[ "$(tech_lead_status "$sha")" == success ]]; then mode=merge; else mode=review; fi
      ;;
    failure | timed_out) mode="ci-failed" ;;
    missing)
      gh workflow run ci.yml --ref "$branch"
      skip "No CI run for $sha; CI dispatched on $branch."
      ;;
    *) skip "CI for PR #$pr is '$ci'; waiting for completion." ;;
  esac

  set_output run true
  set_output pr "$pr"
  set_output issue "$issue"
  set_output sha "$sha"
  set_output branch "$branch"
  set_output role "$role"
  set_output mode "$mode"
  summary "Tech Lead review: PR #$pr (#$issue, $branch) – mode **$mode**"
}

send_back() { # reason-for-dev
  : "${ISSUE:?}"
  set_status "$ISSUE" status:changes-requested
  if [[ -n "${ROLE:-}" ]]; then
    dispatch dev.yml -f issue="$ISSUE" -f role="$ROLE" -f reason="$1"
  else
    escalate "$ISSUE" "Changes requested but the ticket has no agent:* label."
  fi
}

ci_failed() {
  : "${PR:?}" "${ISSUE:?}" "${SHA:?}"
  set_commit_status "$SHA" failure "CI failed"
  local n
  n="$(counter_inc "$ISSUE" ci-fix ":x: CI failed on PR #$PR (\`${SHA:0:7}\`). [CI run](${CI_RUN_URL:-$RUN_URL})")"
  if ((n > ${MAX_CI_FIX_ATTEMPTS:-3})); then
    escalate "$ISSUE" "CI still failing after $((n - 1)) fix attempts (MAX_CI_FIX_ATTEMPTS=$MAX_CI_FIX_ATTEMPTS)."
    return 0
  fi
  send_back ci-failed
}

pending() { set_commit_status "${SHA:?}" pending "Tech Lead is reviewing"; }

merge() {
  : "${PR:?}" "${ISSUE:?}" "${SHA:?}" "${BRANCH:?}"
  # Explicit squash message: the PR title plus the ticket reference. Never concatenated commit
  # bodies, so no trailer (e.g. Co-Authored-By, which the repo forbids) can slip into dev.
  local title
  title="$(gh pr view "$PR" --json title --jq .title)"
  if ! gh api -X PUT "repos/$GH_REPO/pulls/$PR/merge" -f merge_method=squash -f sha="$SHA" \
    -f commit_title="$title (#$PR)" -f commit_message="Refs #$ISSUE" >/dev/null; then
    local mergeable
    mergeable="$(gh pr view "$PR" --json mergeable --jq .mergeable)"
    if [[ "$mergeable" == CONFLICTING ]]; then
      local n
      n="$(counter_inc "$ISSUE" rebase ":twisted_rightwards_arrows: PR #$PR conflicts with dev; rebase needed.")"
      if ((n > ${MAX_REBASE_ATTEMPTS:-3})); then
        escalate "$ISSUE" "Too many rebases (MAX_REBASE_ATTEMPTS=$MAX_REBASE_ATTEMPTS)."
      else
        set_status "$ISSUE" status:needs-rebase
        dispatch dev.yml -f issue="$ISSUE" -f role="$ROLE" -f reason=rebase
      fi
      return 0
    fi
    escalate "$ISSUE" "Approved PR #$PR could not be merged (mergeable=$mergeable). Check the dev ruleset / required checks."
    return 0
  fi
  gh api -X DELETE "repos/$GH_REPO/git/refs/heads/$BRANCH" >/dev/null 2>&1 || true
  set_status "$ISSUE" status:testing
  comment "$ISSUE" ":rocket: PR #$PR merged into \`dev\`. Waiting for Tester."
  # The merge was made with GITHUB_TOKEN, so its push to dev starts no workflow. Hand off explicitly.
  dispatch tester.yml
  dispatch conflict-check.yml
}

apply() {
  : "${PR:?}" "${ISSUE:?}" "${SHA:?}" "${OUTCOME:?}"
  case "$OUTCOME" in
    paused) return 0 ;;
    failed)
      set_commit_status "$SHA" error "Tech Lead review run failed"
      record_failure "$ISSUE" "Tech Lead review"
      exit 1
      ;;
  esac

  local verdict body
  verdict="$(result_get .verdict)"
  body="$(result_get .body)"
  case "$verdict" in
    approve)
      gh pr comment "$PR" --body ":white_check_mark: **Tech Lead: approved.**

$body" >/dev/null
      set_commit_status "$SHA" success "Approved by Tech Lead"
      merge
      ;;
    changes_requested)
      gh pr comment "$PR" --body ":memo: **Tech Lead: changes requested.**

$body" >/dev/null
      set_commit_status "$SHA" failure "Changes requested"
      local n
      n="$(counter_inc "$ISSUE" review-round "Review round on PR #$PR: changes requested.")"
      if ((n > ${MAX_REVIEW_ROUNDS:-3})); then
        escalate "$ISSUE" "Still not approved after $((n - 1)) review rounds (MAX_REVIEW_ROUNDS=$MAX_REVIEW_ROUNDS)."
        return 0
      fi
      send_back changes-requested
      ;;
    needs_human)
      set_commit_status "$SHA" failure "Needs human decision"
      escalate "$ISSUE" "Tech Lead: $body"
      ;;
    *)
      set_commit_status "$SHA" error "Invalid review result"
      record_failure "$ISSUE" "Tech Lead review (invalid verdict '$verdict')"
      exit 1
      ;;
  esac
}

case "$cmd" in
  route) route ;;
  ci-failed) ci_failed ;;
  pending) pending ;;
  apply) apply ;;
  merge) merge ;;
  *) echo "unknown command $cmd" >&2; exit 2 ;;
esac
