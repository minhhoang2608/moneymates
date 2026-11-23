// PostToolUse hook for Edit / Write / MultiEdit: run the formatter/linter for the edited file type,
// only if the tool is installed. Formatting is silent; remaining lint errors are fed back to Claude
// (exit 2 + stderr). Never fails because a tool is missing.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { readInput, relPath, projectDir } from "./lib.mjs";

const input = await readInput();
const file = input.tool_input?.file_path;
const rel = relPath(input, file);
if (!rel || /(^|\/)(node_modules|\.venv|venv|dist|build|android|ios)\//.test(rel)) process.exit(0);

const root = projectDir(input);
const abs = path.join(root, rel);
const win = process.platform === "win32";
const problems = [];

function run(cmd, args, cwd) {
  const r = spawnSync(cmd, args, { cwd, encoding: "utf8", shell: win, timeout: 60_000 });
  return { ok: r.status === 0, out: `${r.stdout || ""}${r.stderr || ""}`.trim(), missing: r.error?.code === "ENOENT" };
}

function localBin(dir, name) {
  const p = path.join(dir, "node_modules", ".bin", win ? `${name}.cmd` : name);
  return existsSync(p) ? p : null;
}

function onPath(name) {
  const r = spawnSync(win ? "where" : "which", [name], { encoding: "utf8" });
  return r.status === 0;
}

const ext = path.extname(rel).toLowerCase();

if ([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".json", ".css"].includes(ext) && rel.startsWith("apps/mobile/")) {
  const appDir = path.join(root, "apps", "mobile");
  const prettier = localBin(appDir, "prettier");
  if (prettier) run(prettier, ["--write", abs], appDir);
  const eslint = localBin(appDir, "eslint");
  if (eslint && [".ts", ".tsx", ".js", ".jsx"].includes(ext)) {
    const r = run(eslint, ["--fix", abs], appDir);
    if (!r.ok && r.out) problems.push(`ESLint (${rel}):\n${r.out}`);
  }
}

if (ext === ".py") {
  const apiDir = path.join(root, "apps", "api");
  const candidates = [
    path.join(apiDir, ".venv", win ? "Scripts\\ruff.exe" : "bin/ruff"),
    path.join(root, ".venv", win ? "Scripts\\ruff.exe" : "bin/ruff"),
  ];
  const ruff = candidates.find((c) => existsSync(c)) || (onPath("ruff") ? "ruff" : null);
  if (ruff) {
    const cwd = existsSync(apiDir) ? apiDir : root;
    run(ruff, ["format", abs], cwd);
    const r = run(ruff, ["check", "--fix", abs], cwd);
    if (!r.ok && r.out) problems.push(`ruff (${rel}):\n${r.out}`);
  }
}

if (ext === ".sh" && onPath("shellcheck")) {
  const r = run("shellcheck", [abs], root);
  if (!r.ok && r.out) problems.push(`shellcheck (${rel}):\n${r.out}`);
}

if (problems.length) {
  process.stderr.write(`Lint problems remain after auto-fix – please fix them:\n\n${problems.join("\n\n").slice(0, 6000)}\n`);
  process.exit(2);
}
process.exit(0);
