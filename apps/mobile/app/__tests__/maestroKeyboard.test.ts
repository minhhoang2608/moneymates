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

  it.each(["groups", "target-line", "settlement", "group-summary", "group-expense"])(
    "%s dismisses the group form keyboard with Enter",
    (f) => {
      const src = read(f);
      expect(src).not.toContain('id: "group-edit-title"');
      expect(src).not.toContain('id: "member-add"\n');
      const lines = src.split("\n");
      const start = lines.findIndex((l) => l.includes("Đà Lạt"));
      const end = lines.findIndex((l) => l.includes('id: "screen-group-edit"'));
      const inputs = lines
        .map((l, i) => (i >= start && i < end && /^- inputText:/.test(l) ? i : -1))
        .filter((i) => i >= 0);
      expect(inputs.length).toBe(3);
      for (const i of inputs) {
        expect(lines[i + 1]).toBe("- pressKey: Enter");
        expect(lines[i + 2]).toBe("- waitForAnimationToEnd");
      }
    },
  );

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
