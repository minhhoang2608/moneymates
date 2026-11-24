import { PAY_APPS } from "../apps";
import { bankCodeForBin, buildAutofillUrl, buildClipboardText, buildOpenUrl, buildTn } from "../deeplink";

const app = (id: string) => PAY_APPS.find((a) => a.id === id)!;

describe("buildAutofillUrl", () => {
  it("mb: bank code (not BIN), amount, trimmed ASCII tn, return url", () => {
    const url = buildAutofillUrl(app("mb"), {
      account: "0123456789",
      bin: "970422",
      amount: 60000,
      message: "Phở bò Hà Nội ngon quá trời luôn nhé",
    });
    expect(url).toBe(
      "https://dl.vietqr.io/pay?app=mb&ba=0123456789%40mb&am=60000&tn=Pho%20bo%20Ha%20Noi%20ngon%20qua%20tr&url=https%3A%2F%2Fwww.vietqr.io",
    );
    expect(url).not.toContain("970422");
  });
  it("ba uses the scanned bank's code, lower-case", () => {
    const url = buildAutofillUrl(app("mb"), { account: "1", bin: "970407", amount: 5 })!;
    expect(url).toContain("ba=1%40tcb");
  });
  it("VietinBank maps to icb", () => {
    expect(bankCodeForBin("970415")).toBe("icb");
    expect(buildAutofillUrl(app("icb"), { account: "9", bin: "970415" })).toContain("app=icb&ba=9%40icb");
  });
  it("adds bn when the name is known, leaves out empty amount and message", () => {
    const url = buildAutofillUrl(app("bidv"), { account: "1", bin: "970418", name: "Nguyễn Văn A", message: "  " })!;
    expect(url).toContain("&bn=Nguyen%20Van%20A&");
    expect(url).not.toContain("am=");
    expect(url).not.toContain("tn=");
  });
  it("unknown bank → null", () => {
    expect(buildAutofillUrl(app("mb"), { account: "1", bin: "999999" })).toBeNull();
  });
});

describe("buildTn", () => {
  it("strips diacritics and caps at 25 characters", () => {
    expect(buildTn("Đi chợ")).toBe("Di cho");
    expect(buildTn("a".repeat(40))).toHaveLength(25);
  });
});

describe("buildOpenUrl", () => {
  it.each([
    ["tcb", "tcb://"],
    ["tpb", "hydro://"],
    ["vcb", "vietcombankmobile://"],
    ["mb", "mbbank://"],
    ["icb", "vietinbankipay://"],
    ["momo", "momo://"],
  ])("%s opens %s", (id, url) => {
    expect(buildOpenUrl(app(id))).toBe(url);
  });
  it("non-autofill apps with a known scheme never go through a browser", () => {
    for (const a of PAY_APPS.filter((x) => !x.supportsAutofill && x.scheme)) {
      expect(buildOpenUrl(a)).not.toContain("http");
    }
  });
  it("app without a known scheme uses the plain VietQR deeplink", () => {
    expect(buildOpenUrl(app("bidv"))).toBe("https://dl.vietqr.io/pay?app=bidv");
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
