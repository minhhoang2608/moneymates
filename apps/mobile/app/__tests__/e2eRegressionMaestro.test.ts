import fs from "fs";
import path from "path";

const dir = path.join(__dirname, "..", "..", ".maestro");
const read = (f: string) => fs.readFileSync(path.join(dir, `${f}.yaml`), "utf8");
const body = (f: string) => read(f).split("\n---\n")[1];

describe("e2e regression maestro flows (#454)", () => {
  it.each(["settlement", "receipt-share", "group-bill"])("%s starts with the launch-fresh subflow", (f) => {
    expect(body(f).startsWith("- runFlow: subflows/launch-fresh.yaml\n")).toBe(true);
    expect(read(f)).not.toMatch(/launchApp:\s*\n\s*clearState/);
  });

  it("group-bill scrolls UP to split-mode-amount after reaching note-input", () => {
    const src = read("group-bill");
    const i = src.indexOf('id: "split-mode-amount"');
    expect(i).toBeGreaterThan(src.indexOf('id: "note-input"'));
    expect(src.slice(i, i + 80)).toMatch(/direction: UP/);
  });

  it("receipt-share waits for e2e-share-receipt after the relaunch", () => {
    const src = read("receipt-share");
    const r = src.indexOf("stopApp: false");
    expect(src.slice(r)).toMatch(
      /extendedWaitUntil:\s*\n\s*visible:\s*\n\s*id: "e2e-share-receipt"\s*\n\s*timeout: 30000/,
    );
  });
});

describe("e2e regression maestro flows (#456)", () => {
  it.each(["add-fab-tabs", "settings-effects", "notif-auto-paid", "handoff-undo"])(
    "%s starts with the launch-fresh subflow",
    (f) => {
      expect(body(f).startsWith("- runFlow: subflows/launch-fresh.yaml\n")).toBe(true);
      expect(read(f)).not.toMatch(/launchApp:\s*\n\s*clearState/);
    },
  );

  it("notif-auto-paid waits for e2e-notif-enable and uses a 30s relaunch wait", () => {
    const src = read("notif-auto-paid");
    expect(src.indexOf('id: "e2e-notif-enable"')).toBeLessThan(src.indexOf('tapOn:\n    id: "e2e-notif-enable"'));
    expect(src).toMatch(/id: "handoff-qr-deleted"\s*\n\s*timeout: 30000/);
  });

  it("handoff-undo waits for screen-pay-confirm before pay-category-more", () => {
    const src = read("handoff-undo");
    expect(src.indexOf('id: "screen-pay-confirm"')).toBeGreaterThan(src.indexOf('id: "scan-e2e-feed"'));
    expect(src.indexOf('id: "screen-pay-confirm"')).toBeLessThan(src.indexOf('id: "pay-category-more"'));
  });
});
