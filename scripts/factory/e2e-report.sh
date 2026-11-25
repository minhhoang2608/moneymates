#!/usr/bin/env bash
# Called by e2e.yml when the Maestro run failed. Files (or updates) a bug ticket so a Dev has something to pick up.
# Reads maestro-results/report.xml; without it, Maestro did not get as far as running the flows.
# shellcheck source=scripts/factory/lib.sh
source "$(dirname "$0")/lib.sh"

report="${1:-maestro-results/report.xml}"
marker="<!-- factory:e2e-failure -->"

if [[ -f "$report" ]]; then
  failed="$(python3 - "$report" <<'PY'
import sys
import xml.etree.ElementTree as ET

for case in ET.parse(sys.argv[1]).getroot().iter("testcase"):
    bad = case.find("failure")
    if bad is None:
        bad = case.find("error")
    if bad is not None:
        msg = (bad.get("message") or (bad.text or "")).strip().splitlines()
        print("- `%s`: %s" % (case.get("name"), msg[0] if msg else "failed"))
PY
)"
else
  failed=""
fi

if [[ -n "$failed" ]]; then
  what="Failing flows (screenshots of each failure are in the \`e2e-results\` artifact of the run):

$failed"
  # shellcheck disable=SC2016 # the backticks are literal Markdown
  key="$(grep -o '`[^`]*`' <<<"$failed" | sort | tr -d '\n')"
else
  what="Maestro did not produce a result file, so it stopped before running the flows (for example an invalid command in a flow file, or the emulator did not boot). Read the failing step in the job log."
  key="no-report"
fi

title="E2E failing on dev"
existing=""
for n in $(gh issue list --state open --label type:bug --search "\"$title\" in:title" --json number --jq '.[].number'); do
  if gh issue view "$n" --json body --jq .body | grep -qF "$marker"; then existing="$n"; break; fi
done

if [[ -n "$existing" ]]; then
  if gh issue view "$existing" --json body,comments --jq '.body, (.comments[].body)' | grep -qF "key:$key"; then
    log "E2E failure already reported on #$existing"
    exit 0
  fi
  comment "$existing" "$marker <!-- key:$key -->
The E2E run failed again ([run]($RUN_URL)).

$what"
  summary "E2E failed: commented on #$existing."
  exit 0
fi

body="$marker <!-- key:$key -->
## Goal

The E2E run on \`dev\` failed ([run]($RUN_URL)). Make the failing flows pass.

## What failed

$what

## Acceptance criteria

- [ ] AC1: Every flow listed above passes in the next E2E run on \`dev\`.
- [ ] AC2: If the flow is wrong, fix the flow. If the app is wrong, fix the app. Say which in the PR."

url="$(gh issue create --title "$title" --label "type:bug,priority:p1,status:triage" --body "$body")"
summary "E2E failed: opened $url."
