// PreToolUse hook for Bash. Blocks:
//  - git push to dev/main, any --force / -f / +refspec, --force-with-lease outside feat/* or fix/*,
//    remote branch deletion, --all/--mirror; in CI any push to a branch other than feat/* or fix/*
//  - PRs into main; in CI: gh pr merge / API merges and editing status:/agent:/needs-human labels
//  - reading .env files or secret variables through the shell
//  - shell writes into docs/ or tests/golden/ (and .github/, .claude/ in CI)
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { readInput, block, inCI, humanOverride } from "./lib.mjs";

const input = await readInput();
const cmd = String(input.tool_input?.command || "");
if (!cmd.trim()) process.exit(0);

// ---------- secrets ----------
const envFile = /(?:^|[\s"'=:/<>])\.env(?:\.[\w-]+)*(?![\w/.-])/g;
for (const m of cmd.match(envFile) || []) {
  if (!/\.(example|sample|template)$/.test(m.trim()))
    block(`'${m.trim()}' – .env files must not be read or written by agents.`);
}
if (/(^|[;&|(]\s*|\s)printenv\b/.test(cmd) || /(^|[;&|(]\s*)env\s*($|[|;&>)])/.test(cmd)) {
  block("dumping the environment would expose secrets.");
}
if (/\$\{?[A-Z0-9_]*(TOKEN|SECRET|PASSWORD|PASSWD|API_KEY|OAUTH|PRIVATE_KEY)[A-Z0-9_]*\}?/.test(cmd)) {
  block("expanding secret environment variables is not allowed.");
}

// ---------- protected paths written via the shell ----------
const protectedDirs = [];
if (!humanOverride) protectedDirs.push("docs", "tests/golden");
if (inCI) protectedDirs.push(".github", ".claude");
for (const dir of protectedDirs) {
  const d = dir.replace(/[.]/g, "\\.").replace("/", "\\/");
  const p = `(?:^|[\\s"'=])(?:\\.\\/)?${d}(?:\\/|\\b)`;
  const writers = [
    new RegExp(`>>?\\s*["']?(?:\\.\\/)?${d}\\/`),
    new RegExp(`\\b(rm|mv|cp|tee|truncate|touch|ln|chmod|install|rsync|unlink)\\b[^;&|\\n]*${p}`),
    new RegExp(`\\b(sed|perl)\\s+[^;&|\\n]*-[a-zA-Z]*i[^;&|\\n]*${p}`),
    new RegExp(`\\bgit\\s+(rm|mv|checkout|restore)\\b[^;&|\\n]*${p}`),
  ];
  if (writers.some((re) => re.test(cmd))) block(`shell command modifies ${dir}/, which is protected.`);
}

// ---------- no AI attribution in commits / PRs (repo rule) ----------
const ATTRIBUTION = /co-authored-by\s*:|generated with \[?claude code/i;
const writesText = /\bgit\b[^;&|\n]*\bcommit\b|\bgh\s+(pr|issue)\s+(create|edit|comment|review)\b|\bgh\s+api\b/;
if (writesText.test(cmd)) {
  let text = cmd;
  // Also inspect message/body files: git commit -F <file>, gh ... --body-file <file>
  for (const m of cmd.matchAll(/(?:\s-F\s+|--file[=\s]+|--body-file[=\s]+)["']?([^\s"']+)/g)) {
    try {
      text += "\n" + readFileSync(path.resolve(input.cwd || process.cwd(), m[1]), "utf8");
    } catch {
      /* unreadable or stdin: nothing to inspect */
    }
  }
  if (ATTRIBUTION.test(text)) {
    block(
      "commit messages and PR/issue text must not contain AI attribution (Co-Authored-By: / 'Generated with Claude Code').",
    );
  }
}

// ---------- gh ----------
// Factory agents (CI) never merge: the Tech Lead review workflow script does. A local session driven
// by the repo owner may merge (e.g. factory maintenance PRs), but never into main.
if (inCI && /\bgh\s+pr\s+merge\b/.test(cmd))
  block("agents never merge; the Tech Lead review workflow merges approved PRs.");
if (inCI && /\bgh\s+api\b[^;&|\n]*\/pulls\/\d+\/merge\b/.test(cmd)) block("merging through the API is not allowed.");
if (/\bgh\s+pr\s+create\b[^;&|\n]*(--base|-B)[=\s]+["']?(main|master)\b/.test(cmd))
  block("agents never open PRs into main.");
if (
  inCI &&
  /\bgh\s+(issue|pr)\s+edit\b[^;&|\n]*--(add|remove)-label[=\s][^;&|\n]*(status:|agent:|needs-human)/.test(cmd)
) {
  block("status:*, agent:* and needs-human labels are set by workflow scripts from .factory/result.json.");
}

// ---------- git push ----------
function currentBranch() {
  try {
    return execSync("git rev-parse --abbrev-ref HEAD", {
      cwd: input.cwd || process.cwd(),
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
  } catch {
    return "";
  }
}

const segments = cmd.split(/&&|\|\||;|\||\n/);
for (const seg of segments) {
  const tokens = seg.trim().replace(/["']/g, "").split(/\s+/);
  const gi = tokens.indexOf("git");
  if (gi === -1) continue;
  const pi = tokens.indexOf("push", gi + 1);
  if (pi === -1) continue;
  // skip git global options between "git" and "push" (e.g. -C dir)
  const args = tokens.slice(pi + 1);

  let force = false;
  let lease = false;
  const positional = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--force") force = true;
    else if (a === "--force-if-includes") continue;
    else if (a.startsWith("--force-with-lease")) lease = true;
    else if (/^-[a-zA-Z]*f[a-zA-Z]*$/.test(a)) force = true;
    else if (a === "--delete" || a === "-d" || /^-[a-zA-Z]*d[a-zA-Z]*$/.test(a))
      block("deleting remote branches is not allowed.");
    else if (a === "--all" || a === "--mirror" || a === "--prune") block(`git push ${a} is not allowed.`);
    else if (a === "-o" || a === "--push-option" || a === "--repo" || a === "--receive-pack" || a === "--exec") i++;
    else if (!a.startsWith("-")) positional.push(a);
  }
  if (force) block("force push is not allowed. Use --force-with-lease on your own feat/* or fix/* branch.");

  const refspecs = positional.slice(1); // first positional is the remote
  const targets = [];
  if (refspecs.length === 0) targets.push(currentBranch());
  for (const r of refspecs) {
    if (r.startsWith("+")) block("'+refspec' is a force push; not allowed.");
    if (r.startsWith(":")) block("deleting remote branches is not allowed.");
    let dst = r.includes(":") ? r.split(":")[1] : r;
    if (dst === "HEAD" || dst === "") dst = currentBranch();
    targets.push(dst.replace(/^refs\/heads\//, ""));
  }
  for (const t of targets) {
    if (/^(dev|main|master)$/.test(t)) block(`direct push to '${t}' is not allowed; open a PR into dev.`);
    const work = /^(feat|fix)\/[\w.-]+/.test(t);
    if (lease && !work)
      block(`--force-with-lease is only allowed on feat/* or fix/* branches (target '${t || "unknown"}').`);
    if (inCI && !work) block(`agents may only push feat/* or fix/* branches (target '${t || "unknown"}').`);
  }
}

process.exit(0);
