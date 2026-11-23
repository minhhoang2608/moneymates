import qr from "../../../../e2e/fixtures/qr.json";
import { scanResultToRoute } from "../../vietqr/scanRoute";
import { parsePayConfirmParams } from "../params";

const paramsOf = (text: string) => {
  const r = scanResultToRoute(text);
  if (!r.ok) throw new Error("expected ok");
  return r.href.params;
};

describe("parsePayConfirmParams", () => {
  it("dynamic TPBank", () => {
    const m = parsePayConfirmParams(paramsOf(qr.dynamic));
    expect(m).toMatchObject({
      kind: "vietqr",
      bankName: "TPBank",
      account: "0123456789",
      name: "NGUYEN VAN A",
      amount: 55000,
      message: "PHO 24",
      isDynamic: true,
      payload: qr.dynamic,
    });
  });

  it("static has no amount", () => {
    const m = parsePayConfirmParams(paramsOf(qr.static));
    expect(m.kind).toBe("vietqr");
    expect(m.amount).toBeUndefined();
    expect(m.isDynamic).toBe(false);
  });

  it("merchant is other, no amount, payload kept", () => {
    const m = parsePayConfirmParams(paramsOf(qr.merchant));
    expect(m.kind).toBe("other");
    expect(m.amount).toBeUndefined();
    expect(m.payload).toBe(qr.merchant);
  });

  it("bad params give a safe other model", () => {
    const m = parsePayConfirmParams({ kind: "vietqr", amount: "-5" });
    expect(m).toMatchObject({ kind: "other", amount: undefined, payload: "" });
    expect(parsePayConfirmParams({}).kind).toBe("other");
  });
});
