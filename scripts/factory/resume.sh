#!/usr/bin/env bash
# Resume sweep (first job of tech-lead-assign.yml, every 30 minutes).
# Finds tickets that are mid-flow but have no agent run queued or running – typically because a run
# was paused by the Claude usage limit, or because a hand-off was lost – and re-dispatches the right
# workflow. Only tickets idle for RESUME_STALE_MINUTES are touched, to avoid racing fresh hand-offs.
# shellcheck source=scripts/factory/lib.sh
source "$(dirname "$0")/lib.sh"

stale="${RESUME_STALE_MINUTES:-20}"
resumed=0

active_dev="$(active_runs dev.yml || true)"
active_review="$(active_runs tech-lead-review.yml || true)"
active_triage="$(active_runs tech-lead-triage.yml || true)"
active_tester="$(active_runs tester.yml || true)"
active_ci="$(active_runs ci.yml || true)"

mentions() { grep -qE "#$2([^0-9]|$)" <<<"$1"; } # mentions <titles> <number>

# Open, not needs-human, idle for $stale minutes, with the given label.
stale_issues() {
  gh issue list --state open --label "$1" --limit 100 --json number,labels,updatedAt \
    --jq ".[] | select([.labels[].name] | index(\"needs-human\") | not)
              | select((now - (.updatedAt | fromdateiso8601)) > ($stale * 60)) | .number"
}

# --- Dev work in progress ---
for pair in "status:in-progress:assigned" "status:changes-requested:changes-requested" "status:needs-rebase:rebase"; do
  label="${pair%:*}"
  reason="${pair##*:}"
  for n in $(stale_issues "$label"); do
    mentions "$active_dev" "$n" && continue
    role="$(role_of_issue "$n")"
    if [[ -z "$role" ]]; then escalate "$n" "Ticket is $label but has no agent:* label."; continue; fi
    dispatch dev.yml -f issue="$n" -f role="$role" -f reason="$reason"
    resumed=$((resumed + 1))
  done
done

# --- Escalated only because a dependency was missing: unblock once every dependency is on dev ---
# Older Dev runs reported a missing dependency as `blocked` (needs-human). Reopen those tickets when every
# "Depends on #N" and every reported blocker is merged or closed. At most twice per ticket, so a ticket
# blocked by something the body does not list cannot loop.
for n in $(gh issue list --state open --label needs-human --limit 100 --json number,labels \
  --jq '.[] | select([.labels[].name] | any(. == "type:epic" or . == "test:real-device" or . == "status:triage") | not) | .number'); do
  comments="$(gh api --paginate "repos/$GH_REPO/issues/$n/comments?per_page=100" --jq '.[].body')"
  last_escalation="$(awk '/<!-- factory:escalation -->/{buf=""} {buf=buf "\n" $0} END{print buf}' <<<"$comments")"
  grep -qiE 'dependenc|not on dev|not merged|still (open|in progress)' <<<"$last_escalation" || continue
  [[ "$(grep -c '<!-- factory:auto-unblock -->' <<<"$comments" || true)" -ge 2 ]] && continue
  body="$(gh issue view "$n" --json body --jq .body)"
  deps="$( { deps_of_body "$body"; waiting_blockers "$n"; } | sort -u)"
  [[ -z "$deps" ]] && continue
  all=true
  for dep in $deps; do dep_satisfied "$dep" || { all=false; break; }; done
  [[ "$all" == true ]] || continue
  gh issue edit "$n" --remove-label needs-human >/dev/null
  dep_list="#${deps//$'\n'/, #}"
  comment "$n" "<!-- factory:auto-unblock -->
:unlock: Every dependency ($dep_list) is merged into dev, so \`needs-human\` was removed automatically. ([run]($RUN_URL))"
  role="$(role_of_issue "$n")"
  if [[ -n "$role" ]] && ! mentions "$active_dev" "$n"; then
    dispatch dev.yml -f issue="$n" -f role="$role" -f reason=assigned
  fi
  resumed=$((resumed + 1))
done

# --- Waiting for review ---
for n in $(stale_issues status:review); do
  pr="$(pr_for_issue "$n")"
  role="$(role_of_issue "$n")"
  if [[ -z "$pr" ]]; then
    mentions "$active_dev" "$n" && continue
    [[ -n "$role" ]] && dispatch dev.yml -f issue="$n" -f role="$role" -f reason=assigned && resumed=$((resumed + 1))
    continue
  fi
  branch="$(gh pr view "$pr" --json headRefName --jq .headRefName)"
  { mentions "$active_review" "$pr" || grep -qF "$branch" <<<"$active_review"; } && continue
  grep -qF "$branch" <<<"$active_ci" && continue
  sha="$(gh pr view "$pr" --json headRefOid --jq .headRefOid)"
  state="$(tech_lead_status "$sha")"
  [[ "$state" == failure ]] && continue # already sent back; the Dev branch above handles it
  dispatch tech-lead-review.yml -f pr="$pr"
  resumed=$((resumed + 1))
done

# --- Waiting for triage ---
if [[ -n "$(stale_issues status:triage | head -n1)" && -z "$active_triage" ]]; then
  dispatch tech-lead-triage.yml
  resumed=$((resumed + 1))
fi

# --- Waiting for Tester ---
if [[ -z "$active_tester" ]]; then
  candidates="$(testing_candidates | tr '\n' ' ')"
  for n in $candidates; do
    upd="$(gh issue view "$n" --json updatedAt --jq "(now - (.updatedAt | fromdateiso8601)) > ($stale * 60)")"
    if [[ "$upd" == true ]]; then
      dispatch tester.yml
      resumed=$((resumed + 1))
      break
    fi
  done
fi

summary "Resume sweep: $resumed hand-off(s) re-dispatched."
