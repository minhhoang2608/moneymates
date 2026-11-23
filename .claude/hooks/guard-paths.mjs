// PreToolUse hook for Read / Edit / Write / MultiEdit / NotebookEdit / Grep.
//  - blocks reading or writing secrets (.env*, keys, keystores, secrets/), except *.example/*.sample
//  - blocks writing docs/** and tests/golden/** (local override FACTORY_HUMAN_OVERRIDE=1, ignored in CI)
//  - in CI also blocks writing .github/**, .claude/** and CLAUDE.md
import { readInput, relPath, block, isSecretPath, protectedWriteReason } from "./lib.mjs";

const input = await readInput();
const tool = input.tool_name || "";
const ti = input.tool_input || {};
const target = ti.file_path || ti.notebook_path || ti.path || "";
const rel = relPath(input, target);

if (
  isSecretPath(rel) ||
  (rel === null && /(^|[\\/])\.env(\.[\w.-]+)?$/.test(target) && !/\.(example|sample|template)$/.test(target))
) {
  block(`${tool} on '${target}' is not allowed: secrets and .env files are off-limits. Use .env.example placeholders.`);
}

const writes = new Set(["Edit", "Write", "MultiEdit", "NotebookEdit"]);
if (writes.has(tool)) {
  const reason = protectedWriteReason(rel);
  if (reason) block(`${tool} on '${rel}': ${reason}`);
}

process.exit(0);
