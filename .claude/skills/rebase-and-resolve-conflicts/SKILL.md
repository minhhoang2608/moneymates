---
name: rebase-and-resolve-conflicts
description: How a Dev agent rebases its own feat/* or fix/* PR branch onto the latest dev, resolves conflicts safely, re-runs tests and pushes with --force-with-lease. Load for run reason "rebase" or when a push is rejected as non-fast-forward.
---

# Rebase onto latest dev

You may rewrite history **only on your own `feat/<n>-…` / `fix/<n>-…` branch**, and only with `--force-with-lease`. Never use `--force` or `-f`, never use `+refspec`, and never push to `dev`/`main`. Hooks block those anyway.

## Steps

```bash
git fetch origin
git checkout <branch>                       # the PR head branch, e.g. feat/12-vietqr-parser
git reset --hard origin/<branch>            # start from what is on GitHub
git rebase origin/dev
```

On conflicts, repeat until the rebase finishes:

1. `git status`, then go through the conflicted files one by one.
2. Understand **both** sides. `dev` contains merged and verified work from other tickets. Keep its behaviour and re-apply your ticket's change on top of it. Never resolve a conflict by just taking "ours" or "theirs" for whole files.
3. Lock files (`package-lock.json`): take dev's version, then regenerate. **During a rebase the meaning is inverted**: `--ours` is `dev` (the base you are replaying onto) and `--theirs` is your commit. So run `git checkout --ours apps/mobile/package-lock.json && (cd apps/mobile && npm install)`, then `git add` the result.
4. Migrations: if both sides added migrations, renumber or re-generate yours on top of dev's. Never edit a migration that is already on dev.
5. `git add <files>` and `git rebase --continue`.

If a conflict needs a product decision, or a dev change makes your ticket obsolete, run `git rebase --abort` and report `blocked` with the reason.

## After the rebase

```bash
# run the full local checks of every app touched (see your agent file)
git push --force-with-lease origin <branch>
```

If `--force-with-lease` is rejected, someone else (a human) pushed to the branch. Fetch, inspect the new commits, and rebase again on top of them. Don't overwrite them.

Result: `{"outcome":"pushed","pr":N,"summary":"Rebased on dev <sha7>; resolved conflicts in …"}`, or `no_changes` if the branch was already up to date and mergeable.
