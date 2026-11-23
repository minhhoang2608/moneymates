#!/usr/bin/env bash
# Classifies one claude-code-action run as:
#   ok     - Claude finished and wrote a valid JSON result file
#   paused - Claude hit the subscription usage limit / rate limit / overload.
#            Not a failure: labels stay as they are, no counters, no needs-human.
#            The resume sweep (tech-lead-assign.yml) re-dispatches after the reset.
#   failed - anything else (crash, max turns, missing/invalid result file)
#
# Env: STEP_OUTCOME (steps.<claude>.outcome), EXECUTION_FILE, RESULT_FILE (default .factory/result.json)
# Output: outcome=<ok|paused|failed> to $GITHUB_OUTPUT
set -euo pipefail

result_file="${RESULT_FILE:-.factory/result.json}"
exec_file="${EXECUTION_FILE:-}"
step_outcome="${STEP_OUTCOME:-failure}"

# Only look at error-ish fields, never at tool output: the code under work may
# legitimately mention "rate limit" (e.g. the API's own request limiter).
errors=""
if [[ -n "$exec_file" && -f "$exec_file" ]]; then
  errors="$(jq -r '
    [ .[]? | select(.type == "result" and (.is_error == true or (.subtype // "" | startswith("error")))) | ((.result // "") + " " + (.subtype // "")) ]
    + [ .[]? | select(.error? != null) | (.error | tostring) ]
    + [ .[]? | select(.type == "assistant" and (.message.model? == "<synthetic>")) | (.message.content[]?.text // "") ]
    | join("\n")' "$exec_file" 2>/dev/null || true)"
fi

limit_re='usage limit|hit your limit|limit reached|limit will reset|rate[_ ]limit|out of extra usage|overloaded|status 429|status 529|"429"|"529"'

valid_result=false
if [[ -s "$result_file" ]] && jq -e 'type == "object"' "$result_file" >/dev/null 2>&1; then valid_result=true; fi

outcome=failed
if [[ "$step_outcome" == "success" && "$valid_result" == true ]]; then
  outcome=ok
elif [[ -n "$errors" ]] && grep -qiE "$limit_re" <<<"$errors"; then
  outcome=paused
elif [[ "$valid_result" == true ]] && grep -q "error_max_turns" <<<"$errors"; then
  # Out of turns, but the agent kept a partial result up to date (e.g. triage): apply what was decided.
  echo "::warning::Agent ran out of turns; applying its partial result."
  outcome=ok
fi

case "$outcome" in
  ok) echo "Agent finished with a valid result." ;;
  paused) echo "::warning::Claude usage limit reached – run paused. Labels unchanged; the resume sweep will continue after the reset." ;;
  failed)
    echo "::error::Agent run failed (step outcome: $step_outcome)."
    if [[ -n "$errors" ]]; then echo "$errors" | head -n 20; fi
    ;;
esac

if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
  echo "### Agent outcome: \`$outcome\`" >>"$GITHUB_STEP_SUMMARY"
fi
if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
  echo "outcome=$outcome" >>"$GITHUB_OUTPUT"
else
  echo "outcome=$outcome"
fi
