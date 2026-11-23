import fs from "fs";
import path from "path";

export type GoldenFixture = {
  domain: string;
  file: string;
  name: string;
  input: Record<string, unknown>;
  expected: Record<string, unknown>;
};

export const DEFAULT_GOLDEN_DIR = path.resolve(__dirname, "../../../tests/golden");

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** Loads every `<root>/<domain>/*.json` fixture. Throws (naming the file) on any problem. */
export function loadGoldenFixtures(rootDir: string = process.env.GOLDEN_DIR ?? DEFAULT_GOLDEN_DIR): GoldenFixture[] {
  if (!fs.existsSync(rootDir) || !fs.statSync(rootDir).isDirectory()) {
    throw new Error(`Golden fixtures directory not found: ${rootDir}`);
  }
  const fixtures: GoldenFixture[] = [];
  const domains = fs
    .readdirSync(rootDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
  for (const domain of domains) {
    const files = fs
      .readdirSync(path.join(rootDir, domain))
      .filter((f) => f.endsWith(".json"))
      .sort();
    for (const file of files) {
      const full = path.join(rootDir, domain, file);
      let data: unknown;
      try {
        data = JSON.parse(fs.readFileSync(full, "utf8"));
      } catch (e) {
        throw new Error(`Invalid JSON in golden fixture ${full}: ${(e as Error).message}`);
      }
      if (!isObject(data) || typeof data.name !== "string" || !isObject(data.input) || !isObject(data.expected)) {
        throw new Error(`Golden fixture ${full} must have name (string), input (object) and expected (object)`);
      }
      fixtures.push({ domain, file, name: data.name, input: data.input, expected: data.expected });
    }
  }
  if (fixtures.length === 0) {
    throw new Error(`No golden fixtures found under ${rootDir}`);
  }
  return fixtures;
}
