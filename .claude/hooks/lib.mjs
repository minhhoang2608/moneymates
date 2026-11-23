// Shared helpers for Claude Code hooks (Node >= 18, no dependencies).
// Hook protocol: JSON on stdin; exit 0 = allow; exit 2 = block (PreToolUse) / feed back (PostToolUse),
// with the reason on stderr.
import path from "node:path";

export const inCI = process.env.GITHUB_ACTIONS === "true";
// Humans may let their LOCAL Claude edit docs/ and tests/golden/. Never honoured in CI.
export const humanOverride = !inCI && process.env.FACTORY_HUMAN_OVERRIDE === "1";

export async function readInput() {
  let raw = "";
  for await (const chunk of process.stdin) raw += chunk;
  try {
    return JSON.parse(raw || "{}");
  } catch {
    return {};
  }
}

// Git Bash / MSYS hands out paths like /e/Project/x on Windows; convert them to E:/Project/x.
function normalize(p) {
  if (process.platform === "win32" && /^\/[a-zA-Z]\//.test(p)) return `${p[1]}:${p.slice(2)}`;
  return p;
}

export function projectDir(input) {
  return normalize(process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd());
}

// Repo-relative POSIX path, or null when the path is outside the project.
export function relPath(input, p) {
  if (!p) return null;
  const roots = [projectDir(input), input.cwd && normalize(input.cwd)].filter(Boolean);
  for (const root of roots) {
    const abs = path.resolve(normalize(input.cwd || root), normalize(p));
    const rel = path.relative(root, abs).split(path.sep).join("/");
    if (!rel.startsWith("..") && !path.isAbsolute(rel)) return rel;
  }
  return null;
}

export function block(reason) {
  process.stderr.write(`Blocked by MoneyMates factory hook: ${reason}\n`);
  process.exit(2);
}

const SECRET_FILE = /(^|\/)(\.env(\.[\w.-]+)?|credentials\.json|google-services\.json|GoogleService-Info\.plist)$/i;
const SECRET_EXT = /\.(pem|key|p12|pfx|jks|keystore)$/i;
const SECRET_OK = /\.(example|sample|template)$/i;

export function isSecretPath(rel) {
  if (!rel) return false;
  if (SECRET_OK.test(rel)) return false;
  if (/(^|\/)debug\.keystore$/.test(rel)) return false;
  return SECRET_FILE.test(rel) || SECRET_EXT.test(rel) || /(^|\/)secrets\//.test(rel);
}

// Paths agents must never write. Returns a reason or null.
export function protectedWriteReason(rel) {
  if (!rel) return null;
  if (!humanOverride) {
    if (rel === "docs" || rel.startsWith("docs/")) return "docs/ is human-owned input (read-only for agents).";
    if (rel.startsWith("tests/golden/") || rel === "tests/golden")
      return "tests/golden/ holds read-only golden fixtures. If a case looks wrong, report `blocked`.";
  }
  if (inCI) {
    if (rel.startsWith(".github/")) return ".github/ (workflows, limits, templates) is human-owned.";
    if (rel.startsWith(".claude/") || rel === "CLAUDE.md") return "agent rules (.claude/, CLAUDE.md) are human-owned.";
  }
  return null;
}
