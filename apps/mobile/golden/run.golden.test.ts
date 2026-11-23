import { loadGoldenFixtures } from "./loadFixtures";
import { DOMAINS, registry } from "./registry";

// A throw here (missing/invalid fixture) fails the whole suite.
const fixtures = loadGoldenFixtures();
const domains = [...new Set(fixtures.map((f) => f.domain))];

test("loads golden fixtures for every documented domain", () => {
  expect(fixtures.length).toBeGreaterThan(0);
  for (const d of DOMAINS) expect(domains).toContain(d);
});

describe.each(domains)("%s", (domain) => {
  const fn = registry[domain];
  for (const f of fixtures.filter((x) => x.domain === domain)) {
    const title = `${domain}/${f.file}: ${f.name}`;
    if (fn) {
      test(title, () => expect(fn(f.input)).toEqual(f.expected));
    } else {
      test.todo(title);
    }
  }
});
