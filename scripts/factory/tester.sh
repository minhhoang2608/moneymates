#!/usr/bin/env bash
# Tester helpers (tester.yml).
#   tester.sh collect [tickets|parents]
#       tickets (default): write .factory/input.json with sub-tickets to verify (the Tester's work).
#       parents: write .factory/input-ba.json with parent features whose sub-tickets are all closed.
#       With BA_VERIFIES_FEATURES=true (factory.env) the BA verifies parent features end to end;
#       otherwise the Tester gets them too and the parents list is empty. Output: count
#   tester.sh apply   - close passed tickets, file bugs, flag real-device checks
# Env for apply: OUTCOME, TESTS_RESULT, E2E_RESULT (job results), INPUT_FILE (default .factory/input.json),
#   VERIFIER (Tester or BA, used in comments), plus the result file.
# shellcheck source=scripts/factory/lib.sh
source "$(dirname "$0")/lib.sh"

cmd="${1:?command required}"
INPUT="${INPUT_FILE:-.factory/input.json}"
VERIFIER="${VERIFIER:-Tester}"

collect() {
  local mode="${1:-tickets}" ba_verifies="${BA_VERIFIES_FEATURES:-true}"
  mkdir -p .factory
  [[ "$mode" == parents ]] && INPUT=.factory/input-ba.json
  local list='[]' n row is_parent
  for n in $(testing_candidates); do
    row="$(gh issue view "$n" --json number,title,body,labels --jq '{number, title, body, labels: [.labels[].name]}')"
    is_parent=false
    jq -e '.labels | index("type:epic")' <<<"$row" >/dev/null && is_parent=true
    # Route: parents go to the BA when enabled; everything else to the Tester.
    if [[ "$mode" == parents ]]; then
      [[ "$is_parent" == true && "$ba_verifies" == true ]] || continue
    else
      [[ "$is_parent" == true && "$ba_verifies" == true ]] && continue
    fi
    if [[ "$is_parent" == true ]]; then
      row="$(jq -c --arg kids "$(children_of "$n" | tr '\n' ' ')" \
        '. + {kind: "parent_feature", sub_tickets: ($kids | split(" ") | map(select(. != "") | tonumber))}' <<<"$row")"
    else
      row="$(jq -c '. + {kind: "ticket"}' <<<"$row")"
    fi
    list="$(jq -c --argjson r "$row" '. + [$r]' <<<"$list")"
  done
  jq -n --argjson issues "$list" \
    --arg tests "${TESTS_RESULT:-unknown}" --arg e2e "${E2E_RESULT:-unknown}" --arg e2esha "${E2E_SHA:-}" \
    --arg sha "${GITHUB_SHA:-}" \
    '{dev_sha: $sha, tests_job: $tests, e2e_job: $e2e, e2e_sha: $e2esha, issues: $issues}' >"$INPUT"
  local count
  count="$(jq '.issues | length' "$INPUT")"
  set_output count "$count"
  summary "To verify on dev ($mode): $count (tests: ${TESTS_RESULT:-?}, e2e: ${E2E_RESULT:-?})"
}

open_bug() { # title body area priority -> prints new issue number
  local title="$1" body="$2" area="$3" priority="$4" existing url
  existing="$(gh issue list --state open --label type:bug --search "\"$title\" in:title" --json number,title \
    --jq ".[] | select(.title == \"$title\") | .number" | head -n1)"
  if [[ -n "$existing" ]]; then echo "$existing"; return 0; fi
  [[ "$area" =~ ^area:(mobile|api|infra)$ ]] || area=area:mobile
  [[ "$priority" =~ ^priority:p[0-3]$ ]] || priority=priority:p1
  url="$(gh issue create --title "$title" --body "$body" --label "type:bug,status:triage,$area,$priority")"
  echo "${url##*/}"
}

apply() {
  : "${OUTCOME:?}"
  local allowed n
  allowed="$(jq -r '.issues[].number' "$INPUT" | tr '\n' ' ')"
  case "$OUTCOME" in
    paused) return 0 ;;
    failed)
      for n in $allowed; do record_failure "$n" "$VERIFIER verification"; done
      exit 1
      ;;
  esac

  local row verdict notes bug filed=0 title body
  while IFS= read -r row; do
    n="$(jq -r .issue <<<"$row")"
    verdict="$(jq -r .verdict <<<"$row")"
    notes="$(jq -r '.notes // ""' <<<"$row")"
    is_in_list "$n" "$allowed" || { log "ignoring #$n (not a candidate)"; continue; }
    case "$verdict" in
      pass)
        comment "$n" ":white_check_mark: **$VERIFIER: verified on \`dev\`** (\`${GITHUB_SHA:0:7}\`).

$notes"
        set_status "$n" status:done
        gh issue close "$n" --reason completed >/dev/null
        ;;
      fail)
        title="$(jq -r '.bug.title // empty' <<<"$row")"
        [[ -z "$title" ]] && title="Acceptance criteria failed for #$n"
        body="$(jq -r '.bug.body // ""' <<<"$row")

---
Found by $VERIFIER while verifying #$n on \`dev\` (\`${GITHUB_SHA:0:7}\`). [run]($RUN_URL)"
        bug="$(open_bug "$title" "$body" "$(jq -r '.bug.area // ""' <<<"$row")" "$(jq -r '.bug.priority // ""' <<<"$row")")"
        comment "$n" "<!-- factory:blocking-bug $bug -->
:x: **$VERIFIER:** acceptance criteria not met on \`dev\`; see bug #$bug. This ticket is re-verified once #$bug is closed.

$notes"
        filed=$((filed + 1))
        ;;
      real_device)
        gh issue edit "$n" --add-label test:real-device >/dev/null
        escalate "$n" "$VERIFIER verified everything possible on the emulator. Remaining checks need a real phone: $notes"
        ;;
      *) log "unknown verdict '$verdict' for #$n" ;;
    esac
  done < <(jq -c '.results[]?' "$RESULT_FILE")

  while IFS= read -r row; do
    [[ -z "$row" ]] && continue
    title="$(jq -r .title <<<"$row")"
    body="$(jq -r '.body // ""' <<<"$row")

---
Regression found by Tester on \`dev\` (\`${GITHUB_SHA:0:7}\`). [run]($RUN_URL)"
    bug="$(open_bug "$title" "$body" "$(jq -r '.area // ""' <<<"$row")" "$(jq -r '.priority // ""' <<<"$row")")"
    log "regression bug #$bug"
    filed=$((filed + 1))
  done < <(jq -c '.regressions[]?' "$RESULT_FILE")

  # Bugs were created with GITHUB_TOKEN, which starts no workflow: hand off to triage explicitly.
  if ((filed > 0)); then dispatch tech-lead-triage.yml; fi
}

# Tests or E2E failed on dev itself: open (or reuse) one p0 regression bug. No Claude needed.
regression() {
  local failed=""
  [[ "${TESTS_RESULT:-}" == failure ]] && failed="unit/API/golden tests"
  [[ "${E2E_RESULT:-}" == failure ]] && failed="${failed:+$failed and }E2E (Maestro)"
  [[ -z "$failed" ]] && return 0
  local bug
  bug="$(open_bug "Regression: $failed failing on dev" "The Tester run on \`dev\` (\`${GITHUB_SHA:0:7}\`) failed: $failed.

Reproduce: re-run the failing job and inspect its log and artifacts (Maestro screenshots).

## Acceptance criteria
- [ ] Tester run on \`dev\` is green again.

[run]($RUN_URL)" area:infra priority:p0)"
  summary "Regression bug: #$bug"
  dispatch tech-lead-triage.yml
}

case "$cmd" in
  collect) collect "${2:-tickets}" ;;
  apply) apply ;;
  regression) regression ;;
  *) echo "unknown command $cmd" >&2; exit 2 ;;
esac
