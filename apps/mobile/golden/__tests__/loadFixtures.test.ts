import fs from "fs";
import os from "os";
import path from "path";

import { loadGoldenFixtures } from "../loadFixtures";

const valid = { name: "case", input: { a: 1 }, expected: { b: 2 } };

function makeRoot(files: Record<string, string>): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "golden-"));
  for (const [rel, content] of Object.entries(files)) {
    const full = path.join(root, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content);
  }
  return root;
}

describe("loadGoldenFixtures", () => {
  test("loads valid fixtures with domain and name", () => {
    const root = makeRoot({ "split/a.json": JSON.stringify(valid), "stats/b.json": JSON.stringify(valid) });
    const got = loadGoldenFixtures(root);
    expect(got.map((f) => [f.domain, f.file, f.name])).toEqual([
      ["split", "a.json", "case"],
      ["stats", "b.json", "case"],
    ]);
  });

  test("ignores README.md and .gitkeep", () => {
    const root = makeRoot({ "README.md": "x", "split/a.json": JSON.stringify(valid), "split/.gitkeep": "" });
    expect(loadGoldenFixtures(root)).toHaveLength(1);
  });

  test("throws on invalid JSON (message names the file)", () => {
    const root = makeRoot({ "split/bad.json": "{nope" });
    expect(() => loadGoldenFixtures(root)).toThrow(/bad\.json/);
  });

  test.each(["name", "input", "expected"])("throws when %s is missing", (key) => {
    const broken: Record<string, unknown> = { ...valid };
    delete broken[key];
    const root = makeRoot({ "split/x.json": JSON.stringify(broken) });
    expect(() => loadGoldenFixtures(root)).toThrow(/x\.json/);
  });

  test("throws when root dir is missing", () => {
    expect(() => loadGoldenFixtures(path.join(os.tmpdir(), "does-not-exist-golden"))).toThrow(/not found/);
  });

  test("throws when no fixtures found", () => {
    const root = makeRoot({ "README.md": "x" });
    expect(() => loadGoldenFixtures(root)).toThrow(/No golden fixtures/);
  });

  test("loads the real tests/golden set (>0, all 6 domains)", () => {
    const got = loadGoldenFixtures();
    expect(got.length).toBeGreaterThan(0);
    const domains = new Set(got.map((f) => f.domain));
    for (const d of ["money-parse", "split", "settlement", "stats", "vietqr-generate", "vietqr-parse"]) {
      expect(domains.has(d)).toBe(true);
    }
  });
});
