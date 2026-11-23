#!/usr/bin/env bash
# Tech Lead assignment helpers (tech-lead-assign.yml).
#   assign.sh collect - work out idle Devs and eligible tickets (deps merged), write .factory/input.json
#                       outputs: needed (true when there is at least one idle Dev and one eligible ticket)
#   assign.sh apply   - validate and apply Claude's assignments, then dispatch dev.yml
# shellcheck source=scripts/factory/lib.sh
source "$(dirname "$0")/lib.sh"

cmd="${1:?command required}"
INPUT=.factory/input.json

enabled_roles() {
  tr ',' '\n' <<<"${DEV_ROLES_PRIORITY:-dev-fullstack,dev-be,dev-fe}" | head -n "${MAX_PARALLEL_DEVS:-3}" | tr '\n' ' '
}

busy_issue_for_role() { # role -> issue number holding the role, if any
  gh issue list --state open --label "agent:$1" --limit 50 --json number,labels \
    --jq ".[] | select([.labels[].name] | index(\"needs-human\") | not)
               | select([.labels[].name] | any(. as \$l | \"$ACTIVE_DEV_STATUSES\" | split(\" \") | index(\$l)))
               | .number" | head -n1
}

collect() {
  mkdir -p .factory
  local role idle="" busy
  for role in $(enabled_roles); do
    busy="$(busy_issue_for_role "$role")"
    if [[ -z "$busy" ]]; then idle="$idle $role"; else log "$role busy with #$busy"; fi
  done
  idle="${idle# }"

  local eligible='[]' row n body dep ok
  while IFS= read -r row; do
    [[ -z "$row" ]] && continue
    n="$(jq -r .number <<<"$row")"
    body="$(jq -r '.body // ""' <<<"$row")"
    ok=true
    for dep in $(deps_of_body "$body"); do
      if ! dep_satisfied "$dep"; then ok=false; log "#$n waits for #$dep"; fi
    done
    if [[ "$ok" == true ]]; then eligible="$(jq -c --argjson r "$row" '. + [$r]' <<<"$eligible")"; fi
  done < <(gh issue list --state open --label status:ready --limit 100 --json number,title,body,labels \
    --jq '.[] | select([.labels[].name] | (index("needs-human") or index("type:epic")) | not)
              | {number, title, body: (.body[0:1500]), labels: [.labels[].name]} | @json')

  local inflight
  inflight="$(gh issue list --state open --limit 100 --json number,title,body,labels \
    --jq "[.[] | select([.labels[].name] | any(. as \$l | \"$ACTIVE_DEV_STATUSES\" | split(\" \") | index(\$l)))
              | {number, title, body: (.body[0:800]), labels: [.labels[].name]}]")"

  # Only roles with at least one compatible eligible ticket count as usable. FE takes mobile-only,
  # BE takes api-only, Fullstack takes anything (infra, both areas, or overflow). This keeps the
  # event-driven runs (see kick_assign) from calling Claude when nothing can be assigned.
  jq -n --arg idle "$idle" --argjson eligible "$eligible" --argjson inflight "$inflight" '
    def mobile: .labels | index("area:mobile");
    def api: .labels | index("area:api");
    ($idle | split(" ") | map(select(. != ""))) as $idle_all
    | {idle_roles: ($idle_all | map(select(
          . as $r
          | if $r == "dev-fe" then any($eligible[]; mobile and (api | not))
            elif $r == "dev-be" then ($eligible | length) > 0
            else ($eligible | length) > 0 end))),
       eligible: $eligible, in_flight: $inflight}' >"$INPUT"

  local usable n_eligible
  usable="$(jq -r '.idle_roles | join(" ")' "$INPUT")"
  n_eligible="$(jq '.eligible | length' "$INPUT")"
  summary "Idle Devs: ${idle:-none} · with a compatible ticket: ${usable:-none} · eligible tickets: $n_eligible"
  if [[ -n "$usable" ]]; then set_output needed true; else set_output needed false; fi
}

apply() {
  : "${OUTCOME:?}"
  case "$OUTCOME" in
    paused) return 0 ;;
    failed) echo "::error::Assignment run failed"; exit 1 ;;
  esac
  local idle eligible used_roles="" used_issues="" row issue role reason
  idle="$(jq -r '.idle_roles | join(" ")' "$INPUT")"
  eligible="$(jq -r '[.eligible[].number] | join(" ")' "$INPUT")"
  while IFS= read -r row; do
    issue="$(jq -r .issue <<<"$row")"
    role="$(jq -r .role <<<"$row")"
    reason="$(jq -r '.reason // ""' <<<"$row")"
    if ! is_in_list "$role" "$idle" || is_in_list "$role" "$used_roles"; then
      log "rejecting #$issue -> $role (role not idle or already used)"; continue
    fi
    if ! is_in_list "$issue" "$eligible" || is_in_list "$issue" "$used_issues"; then
      log "rejecting #$issue -> $role (ticket not eligible or already used)"; continue
    fi
    used_roles="$used_roles $role"
    used_issues="$used_issues $issue"
    gh issue edit "$issue" --add-label "agent:$role" >/dev/null
    set_status "$issue" status:in-progress
    comment "$issue" ":busts_in_silhouette: **Assigned to $role.** $reason"
    dispatch dev.yml -f issue="$issue" -f role="$role" -f reason=assigned
    summary "Assigned #$issue -> $role"
  done < <(jq -c '.assignments[]?' "$RESULT_FILE")
}

case "$cmd" in
  collect) collect ;;
  apply) apply ;;
  *) echo "unknown command $cmd" >&2; exit 2 ;;
esac
