import fs from "fs";
import path from "path";

const FLOWS = [
  "groups",
  "target-line",
  "settlement",
  "group-summary",
  "group-expense",
  "settings",
  "settings-effects",
  "categories",
];
const TARGETS = [
  "group-edit-title",
  "category-sheet-title",
  "amount-preview",
  "account-no-label",
  "settings-general-heading",
];
const dir = path.join(__dirname, "..", "..", ".maestro");
const read = (f: string) => fs.readFileSync(path.join(dir, `${f}.yaml`), "utf8");

describe("maestro keyboard dismissal", () => {
  it.each(FLOWS)("%s has no bare hideKeyboard", (f) => {
    expect(read(f)).not.toMatch(/^\s*-\s*hideKeyboard\s*$/m);
  });

  it("only uses allow-listed dismiss targets", () => {
    const ids = new Set<string>();
    for (const f of FLOWS) {
      for (const m of read(f).matchAll(/id: "([^"]+)"\n- waitForAnimationToEnd/g)) ids.add(m[1]);
    }
    expect(ids.size).toBeGreaterThan(0);
    for (const id of ids) expect(TARGETS).toContain(id);
  });

  it("screens render the dismiss targets", () => {
    const app = path.join(__dirname, "..");
    expect(fs.readFileSync(path.join(app, "group", "edit.tsx"), "utf8")).toContain('testID="group-edit-title"');
    expect(fs.readFileSync(path.join(app, "group", "edit.tsx"), "utf8")).toContain("onPress={Keyboard.dismiss}");
    expect(
      fs.readFileSync(path.join(app, "..", "src", "components", "category", "CategoryEditSheet.tsx"), "utf8"),
    ).toContain('testID="category-sheet-title"');
    expect(fs.readFileSync(path.join(app, "bank-accounts.tsx"), "utf8")).toContain('testID="account-no-label"');
    expect(fs.readFileSync(path.join(app, "settings.tsx"), "utf8")).toContain('testID="settings-general-heading"');
  });
});
