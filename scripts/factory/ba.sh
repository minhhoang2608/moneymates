#!/usr/bin/env bash
# BA helpers (ba.yml).
#   ba.sh collect - write .factory/existing.json (all issues, any state) for de-duplication
#   ba.sh apply   - normalise labels of created issues and hand off to triage
# shellcheck source=scripts/factory/lib.sh
source "$(dirname "$0")/lib.sh"

cmd="${1:?command required}"

collect() {
  mkdir -p .factory
  gh issue list --state all --limit 500 --json number,title,state,labels \
    --jq '[.[] | {number, title, state, labels: [.labels[].name]}]' >.factory/existing.json
  summary "Existing issues: $(jq length .factory/existing.json)"
}

apply() {
  : "${OUTCOME:?}"
  case "$OUTCOME" in
    paused) return 0 ;;
    failed) echo "::error::BA run failed"; exit 1 ;;
  esac
  local created=0 n
  for n in $(jq -r '.created[]? // empty' "$RESULT_FILE"); do
    [[ "$(issue_state "$n" 2>/dev/null || true)" == OPEN ]] || continue
    set_status "$n" status:triage
    created=$((created + 1))
  done
  summary "BA created $created issue(s)."
  if ((created > ${MAX_BA_ISSUES_PER_RUN:-10})); then
    echo "::warning::BA created $created issues, above MAX_BA_ISSUES_PER_RUN=$MAX_BA_ISSUES_PER_RUN"
  fi
  if ((created > 0)); then dispatch tech-lead-triage.yml; fi
}

case "$cmd" in
  collect) collect ;;
  apply) apply ;;
  *) echo "unknown command $cmd" >&2; exit 2 ;;
esac
