#!/usr/bin/env bash
# Weekly factory report: opens an issue labelled report:weekly with what was done, what is blocked
# (needs-human), what is in progress, and how many agent runs / Actions minutes were used.
# Closes the previous report. Uses no Claude quota.
# shellcheck source=scripts/factory/lib.sh
source "$(dirname "$0")/lib.sh"

since="$(date -u -d '7 days ago' +%Y-%m-%d)"
today="$(date -u +%Y-%m-%d)"

issue_lines() { jq -r '.[] | "- #\(.number) \(.title)"'; }

done_list="$(gh issue list --state closed --label status:done --search "closed:>=$since" --limit 200 --json number,title | issue_lines)"
blocked_list="$(gh issue list --state open --label needs-human --limit 200 --json number,title,labels \
  --jq '.[] | "- #\(.number) \(.title) — \([.labels[].name | select(startswith("status:") or . == "test:real-device")] | join(", "))"')"
# $l below is a jq variable, not a shell one.
# shellcheck disable=SC2016
progress_list="$(gh issue list --state open --limit 200 --json number,title,labels \
  --jq '.[] | select([.labels[].name] | index("needs-human") | not)
            | (.labels | map(.name) | map(select(test("^(status:(in-progress|review|changes-requested|needs-rebase|testing)|agent:)"))) | join(", ")) as $l
            | select($l | test("status:")) | "- #\(.number) \(.title) — \($l)"')"
count_label() { gh issue list --state open --label "$1" --limit 500 --json number --jq length; }

runs_table="| Workflow | Runs | Success | Failure | Cancelled | ~Minutes |
| --- | --- | --- | --- | --- | --- |"
for wf in ba.yml tech-lead-triage.yml tech-lead-assign.yml dev.yml tech-lead-review.yml conflict-check.yml tester.yml ci.yml; do
  row="$(gh run list --workflow "$wf" --created ">=$since" --limit 1000 --json conclusion,createdAt,updatedAt \
    --jq '[length,
           (map(select(.conclusion=="success"))|length),
           (map(select(.conclusion=="failure"))|length),
           (map(select(.conclusion=="cancelled"))|length),
           (map((.updatedAt|fromdateiso8601) - (.createdAt|fromdateiso8601)) | add // 0 | ./60 | floor)]
          | map(tostring) | join(" | ")' 2>/dev/null || echo "0 | 0 | 0 | 0 | 0")"
  runs_table="$runs_table
| \`$wf\` | $row |"
done

body="## Factory report $since → $today

**Factory enabled:** \`${FACTORY_ENABLED:-unknown}\` · Backlog: $(count_label status:triage) triage, $(count_label status:ready) ready

### :white_check_mark: Done this week
${done_list:-_Nothing closed this week._}

### :raising_hand: Blocked – needs a human
${blocked_list:-_Nothing blocked._}

### :hammer_and_wrench: In progress
${progress_list:-_Nothing in progress._}

### :bar_chart: Agent runs and Actions usage (last 7 days)
$runs_table

_Minutes are wall-clock run durations (an approximation of billed minutes). Runs paused by the Claude usage limit end as **success** with a \"paused\" warning in the run summary. Claude Pro usage itself is not visible to GitHub; check it at claude.ai → Settings → Usage._"

for old in $(gh issue list --state open --label report:weekly --json number --jq '.[].number'); do
  gh issue close "$old" --comment "Superseded by the new weekly report." >/dev/null
done
gh issue create --title "Factory weekly report – $today" --label report:weekly --body "$body"
