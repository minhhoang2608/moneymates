#!/usr/bin/env bash
# Tech Lead triage helpers (tech-lead-triage.yml). Triage handles every status:triage issue in one batch.
#   triage.sh collect - write .factory/input.json (issues to triage) + .factory/context.json (open backlog)
#                       outputs: count
#   triage.sh apply   - apply decisions from .factory/result.json
# shellcheck source=scripts/factory/lib.sh
source "$(dirname "$0")/lib.sh"

cmd="${1:?command required}"
INPUT=.factory/input.json

collect() {
  mkdir -p .factory
  local all="$RUNNER_TEMP/triage-all.json"
  # Highest priority first (p0 < p1 < … ; no priority last), then oldest.
  gh issue list --state open --label status:triage --limit 100 --json number,title,body,labels \
    --jq '[.[] | select([.labels[].name] | index("needs-human") | not)
           | {number, title, body, labels: [.labels[].name]}
           | . + {prio: ([.labels[] | select(startswith("priority:p")) | ltrimstr("priority:p") | tonumber] | min // 9)}]
          | sort_by(.prio, .number) | map(del(.prio))' >"$all"
  jq --argjson n "${MAX_TRIAGE_PER_RUN:-3}" '.[:$n]' "$all" >"$INPUT"
  gh issue list --state open --limit 200 --json number,title,labels \
    --jq '[.[] | {number, title, labels: [.labels[].name]}]' >.factory/context.json
  local count total
  count="$(jq length "$INPUT")"
  total="$(jq length "$all")"
  set_output count "$count"
  set_output remaining "$((total - count))"
  summary "Issues to triage: $count this run (#$(jq -r '[.[].number] | join(", #")' "$INPUT")), $((total - count)) left for the next run"
}

apply() {
  : "${OUTCOME:?}"
  local allowed n
  allowed="$(jq -r '.[].number' "$INPUT" | tr '\n' ' ')"
  case "$OUTCOME" in
    paused) return 0 ;;
    failed)
      for n in $allowed; do record_failure "$n" "Tech Lead triage"; done
      exit 1
      ;;
  esac

  local row decision reason child dup
  while IFS= read -r row; do
    n="$(jq -r .number <<<"$row")"
    decision="$(jq -r .decision <<<"$row")"
    reason="$(jq -r '.reason // ""' <<<"$row")"
    if ! is_in_list "$n" "$allowed"; then
      log "ignoring decision for #$n (not in this triage batch)"
      continue
    fi
    case "$decision" in
      ready)
        local labels
        labels="$(issue_labels "$n" | tr '\n' ' ')"
        if [[ "$labels" != *type:* || "$labels" != *priority:* || "$labels" != *area:* ]]; then
          escalate "$n" "Triaged as ready but missing type/priority/area labels."
        else
          set_status "$n" status:ready
          [[ -n "$reason" ]] && comment "$n" ":white_check_mark: **Triage:** ready. $reason"
        fi
        ;;
      split | epic)
        # The feature becomes a parent: never assigned; the Tester verifies it end to end once all children are closed.
        local children="" missing=""
        for child in $(jq -r '.children[]? // empty' <<<"$row"); do
          if [[ "$(issue_state "$child" 2>/dev/null || true)" != OPEN ]]; then continue; fi
          if ! issue_labels "$child" | grep -q '^area:'; then missing="$missing #$child"; fi
          children="$children $child"
        done
        children="${children# }"
        if [[ -z "$children" ]]; then
          escalate "$n" "Triage reported a split but created no valid sub-tickets."
          continue
        fi
        if [[ -n "$missing" ]]; then
          escalate "$n" "Sub-tickets without area:* label:$missing"
          continue
        fi
        for child in $children; do set_status "$child" status:ready; done
        gh issue edit "$n" --add-label type:epic --remove-label type:feature >/dev/null 2>&1 ||
          gh issue edit "$n" --add-label type:epic >/dev/null
        clear_status "$n"
        comment "$n" "<!-- factory:children $children -->
:jigsaw: **Triage:** split into sub-tickets $(sed -E 's/([0-9]+)/#\1/g; s/ /, /g' <<<"$children"). This feature is verified end to end by the Tester once all of them are closed.

$reason"
        ;;
      duplicate)
        dup="$(jq -r '.duplicate_of // empty' <<<"$row")"
        clear_status "$n"
        gh issue close "$n" --reason "not planned" --comment ":link: Duplicate of #$dup. $reason" >/dev/null
        ;;
      needs_human)
        escalate "$n" "Triage: $reason"
        ;;
      *)
        log "unknown decision '$decision' for #$n"
        ;;
    esac
  done < <(jq -c '.issues[]?' "$RESULT_FILE")

  # More issues waiting: chain the next batch (dispatch, since GITHUB_TOKEN label events start nothing).
  if ((${REMAINING:-0} > 0)); then
    dispatch tech-lead-triage.yml
  fi

  # New sub-tickets may now be ready: hand them to idle Devs right away.
  if gh issue list --state open --label status:ready --limit 1 --json number --jq 'length > 0' | grep -q true; then
    kick_assign
  fi
}

case "$cmd" in
  collect) collect ;;
  apply) apply ;;
  *) echo "unknown command $cmd" >&2; exit 2 ;;
esac
