import type { PayApp } from "../apps";
import { pickerApps, preselectApp, recordLastUsed } from "../preselect";

const mk = (id: string, name: string, bin?: string, type: PayApp["type"] = "bank"): PayApp => ({
  id,
  type,
  name,
  short: name,
  bin,
  deeplinkCode: id,
  supportsAutofill: true,
});
const CAT = [
  mk("tpb", "TPBank", "970423"),
  mk("vcb", "Vietcombank", "970436"),
  mk("tcb", "Techcombank", "970407"),
  mk("momo", "MoMo", undefined, "wallet"),
];
const TPB = "970423";

describe("recordLastUsed", () => {
  it("normalizes ids, ignores blank BIN, does not mutate", () => {
    const m = {};
    expect(recordLastUsed(m, TPB, "tpbank")).toEqual({ [TPB]: "tpb" });
    expect(recordLastUsed(m, " ", "vcb")).toEqual({});
    expect(m).toEqual({});
  });
});

describe("preselectApp", () => {
  it("prefers last used for the bank", () => {
    expect(preselectApp(TPB, ["tpb", "vcb"], { [TPB]: "tpb" }, CAT)).toBe("tpb");
    expect(preselectApp(TPB, ["vcb"], { [TPB]: "tpb" }, CAT)).toBe("tpb");
    expect(preselectApp(TPB, ["tpb"], { [TPB]: "tpbank" }, CAT)).toBe("tpb");
    expect(preselectApp(TPB, ["tpb", "momo"], { [TPB]: "momo" }, CAT)).toBe("momo");
  });
  it("falls through when last used is gone or disabled", () => {
    expect(preselectApp(TPB, ["vcb"], { [TPB]: "ghost" }, CAT)).toBe("tpb");
    expect(preselectApp(TPB, ["vcb"], { [TPB]: "momo" }, CAT)).toBe("tpb");
  });
  it("uses the QR bank app even when disabled", () => {
    expect(preselectApp(TPB, ["vcb"], {}, CAT)).toBe("tpb");
  });
  it("falls back to first known enabled app, else undefined", () => {
    expect(preselectApp("999999", ["vcb", "tcb"], {}, CAT)).toBe("vcb");
    expect(preselectApp("999999", ["ghost", "tcb"], {}, CAT)).toBe("tcb");
    expect(preselectApp("999999", [], {}, CAT)).toBeUndefined();
    expect(preselectApp(undefined, ["vcb"], {}, CAT)).toBe("vcb");
  });
});

describe("pickerApps", () => {
  const ids = (r: ReturnType<typeof pickerApps>) => r.map((x) => x.app.id);
  it("blank query: QR bank first, enabled only, no duplicates", () => {
    const r = pickerApps(["vcb", "momo"], TPB, [], "", CAT);
    expect(ids(r)).toEqual(["tpb", "vcb", "momo"]);
    expect(r[0]).toMatchObject({ isQrBank: true });
    expect(ids(pickerApps(["vcb", "tpb"], TPB, [], "", CAT))).toEqual(["tpb", "vcb"]);
  });
  it("flags recents and orders them after the QR bank", () => {
    const r = pickerApps(["vcb", "tcb", "momo"], TPB, ["tcb", "tpbank"], "", CAT);
    expect(ids(r)).toEqual(["tpb", "tcb", "vcb", "momo"]);
    expect(r.map((x) => x.isRecent)).toEqual([true, true, false, false]);
  });
  it("query searches whole catalogue, including disabled apps", () => {
    for (const q of ["vietcom", "Vietcom", "VIETCOM"])
      expect(ids(pickerApps(["tpb"], TPB, [], q, CAT))).toEqual(["vcb"]);
    expect(pickerApps(["tpb"], TPB, [], "zzz", CAT)).toEqual([]);
    expect(ids(pickerApps(["tcb"], TPB, [], "bank", CAT))).toEqual(["tpb", "tcb", "vcb"]);
  });
});
