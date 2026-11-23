import qr from "../../../../e2e/fixtures/qr.json";
import { scanResultToRoute } from "../scanRoute";

describe("scanResultToRoute", () => {
  it("dynamic TPBank → pay-confirm with bank/account/55000/PHO 24", () => {
    const r = scanResultToRoute(qr.dynamic);
    expect(r).toEqual({
      ok: true,
      href: {
        pathname: "/pay-confirm",
        params: {
          kind: "vietqr",
          bankBin: "970423",
          bankName: "TPBank",
          account: "0123456789",
          name: "NGUYEN VAN A",
          amount: "55000",
          message: "PHO 24",
          isDynamic: "1",
        },
      },
    });
  });

  it("static code has no amount, isDynamic false", () => {
    const r = scanResultToRoute(qr.static);
    if (!r.ok) throw new Error("expected ok");
    expect(r.href.params.amount).toBeUndefined();
    expect(r.href.params.isDynamic).toBe("0");
  });

  it("merchant → kind other", () => {
    const r = scanResultToRoute(qr.merchant);
    if (!r.ok) throw new Error("expected ok");
    expect(r.href.params.kind).toBe("other");
    expect(r.href.params.payload).toBe(qr.merchant);
  });

  it("garbage / wrong CRC → error", () => {
    expect(scanResultToRoute(qr.invalid)).toEqual({ ok: false });
    expect(scanResultToRoute(qr.dynamic.slice(0, -1) + "0")).toEqual({ ok: false });
  });
});
