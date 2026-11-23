#!/usr/bin/env bash
# After every change to dev: find open factory PRs that now conflict with dev,
# mark their ticket status:needs-rebase and wake up the owning Dev.
# shellcheck source=scripts/factory/lib.sh
source "$(dirname "$0")/lib.sh"

mergeable_of() { # GitHub computes mergeability lazily; poll until it is known.
  local pr="$1" state i
  for i in 1 2 3 4 5 6; do
    state="$(gh pr view "$pr" --json mergeable --jq .mergeable)"
    [[ "$state" != UNKNOWN ]] && break
    log "PR #$pr mergeable=UNKNOWN (try $i), waiting"
    sleep 10
  done
  echo "$state"
}

found=0
while IFS=$'\t' read -r pr branch; do
  [[ -z "$pr" ]] && continue
  issue="$(issue_from_branch "$branch")"
  [[ -z "$issue" ]] && continue
  [[ "$(mergeable_of "$pr")" == CONFLICTING ]] || continue
  found=$((found + 1))
  if has_label "$issue" needs-human; then log "#$issue is needs-human; skip"; continue; fi
  status="$(current_status "$issue")"
  if [[ "$status" == status:needs-rebase ]]; then log "#$issue already needs-rebase"; continue; fi
  role="$(role_of_issue "$issue")"
  n="$(counter_inc "$issue" rebase ":twisted_rightwards_arrows: PR #$pr conflicts with the latest \`dev\`; rebase needed.")"
  if ((n > ${MAX_REBASE_ATTEMPTS:-3})); then
    escalate "$issue" "PR #$pr needed more than MAX_REBASE_ATTEMPTS=$MAX_REBASE_ATTEMPTS rebases."
    continue
  fi
  set_status "$issue" status:needs-rebase
  if [[ -n "$role" ]]; then
    dispatch dev.yml -f issue="$issue" -f role="$role" -f reason=rebase
  else
    escalate "$issue" "PR #$pr conflicts but the ticket has no agent:* label."
  fi
done < <(gh pr list --state open --base dev --limit 100 --json number,headRefName --jq '.[] | "\(.number)\t\(.headRefName)"')

summary "Conflicting factory PRs: $found"
