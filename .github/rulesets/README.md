# Branch rulesets

Rulesets on a **private** repository need GitHub Pro, Team or Enterprise. The GitHub API returns 403 on the Free plan. These files hold the intended rules so they can be applied with one command after upgrading (or if the repository becomes public).

| File | Branch | Rules |
| --- | --- | --- |
| `dev.json` | `dev` | No deletion, no force push, PR required (0 approvals), required checks `ci-gate` + `tech-lead-review` (any source, branch need not be up to date), repository admins may bypass |
| `main.json` | `main` | No deletion, no force push, PR required (0 approvals), required check `ci-gate`, repository admins may bypass |

Apply:

```bash
for b in dev main; do gh api -X POST repos/minhhoang2608/moneymates/rulesets --input .github/rulesets/$b.json; done
```

Until then, the factory still works: workflow scripts only merge after green CI and an approving Tech Lead review. Nothing prevents a manual merge, though.
