import { PAY_APPS } from "../apps";
import { buildClipboardText, buildOpenUrl } from "../deeplink";

describe("buildOpenUrl", () => {
  it.each([
    ["tcb", "tcb://"],
    ["tpbank", "hydro://"],
    ["vcb", "vietcombankmobile://"],
    ["mb", "mbbank://"],
    ["icb", "vietinbankipay://"],
    ["momo", "momo://"],
  ])("%s opens %s", (id, url) => {
    expect(buildOpenUrl(PAY_APPS.find((a) => a.id === id)!)).toBe(url);
  });
  it("never goes through a browser", () => {
    for (const a of PAY_APPS) {
      const url = buildOpenUrl(a);
      expect(url).not.toContain("http");
      expect(url).not.toContain("dl.vietqr.io");
    }
  });
});

describe("buildClipboardText", () => {
  it("joins account, amount and message", () => {
    expect(buildClipboardText({ account: "0123", amount: 60000, message: " PHO " })).toBe("0123 60000 PHO");
  });
  it("leaves out an empty or whitespace message", () => {
    expect(buildClipboardText({ account: "0123", amount: 60000 })).toBe("0123 60000");
    expect(buildClipboardText({ account: "0123", amount: 60000, message: "  " })).toBe("0123 60000");
  });
  it("leaves out an invalid amount", () => {
    expect(buildClipboardText({ account: "0123", amount: 0, message: "A" })).toBe("0123 A");
    expect(buildClipboardText({ account: "0123", amount: 1.5 })).toBe("0123");
  });
});
