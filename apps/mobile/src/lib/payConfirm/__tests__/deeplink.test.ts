import { PAY_APPS } from "../apps";
import { buildAutofillUrl, buildOpenUrl } from "../deeplink";

const tpb = PAY_APPS[0];

describe("deeplink", () => {
  it("encodes account, integer amount and message", () => {
    expect(
      buildAutofillUrl(tpb, { account: "0123456789", bin: "970423", amount: 55000, message: "PHO 24 & ca phe" }),
    ).toBe("https://dl.vietqr.io/pay?app=tpb&ba=0123456789%40970423&am=55000&tn=PHO%2024%20%26%20ca%20phe");
  });
  it("leaves am and tn out when missing", () => {
    expect(buildAutofillUrl(tpb, { account: "1", bin: "970423" })).toBe(
      "https://dl.vietqr.io/pay?app=tpb&ba=1%40970423",
    );
  });
  it("builds the plain open url", () => {
    expect(buildOpenUrl(tpb)).toBe("tpbank://");
  });
});
