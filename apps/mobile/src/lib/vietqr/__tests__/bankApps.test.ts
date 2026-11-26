import { SNAPSHOT, createMockSource, registryPayApps, snapshotSource, toPayApp } from "../bankApps";

describe("bank apps snapshot", () => {
  it("has the contract shape", () => {
    expect(typeof SNAPSHOT.updated_at).toBe("string");
    expect(SNAPSHOT.stale).toBe(false);
    for (const a of SNAPSHOT.apps) {
      expect(typeof a.app_id).toBe("string");
      expect(typeof a.name).toBe("string");
      expect(typeof a.autofill.android).toBe("boolean");
      expect(typeof a.autofill.ios).toBe("boolean");
    }
  });
  it("contains the #206 apps with their autofill flags, bins and codes", () => {
    const expected: Record<string, [boolean, string, string]> = {
      mb: [true, "970422", "MB"],
      icb: [true, "970415", "ICB"],
      bidv: [true, "970418", "BIDV"],
      acb: [true, "970416", "ACB"],
      ocb: [true, "970448", "OCB"],
      tcb: [false, "970407", "TCB"],
      tpb: [false, "970423", "TPB"],
      vcb: [false, "970436", "VCB"],
    };
    for (const [id, [auto, bin, code]] of Object.entries(expected)) {
      const a = SNAPSHOT.apps.find((x) => x.app_id === id)!;
      expect(a.autofill).toEqual({ android: auto, ios: auto });
      expect([a.bin, a.bank_code]).toEqual([bin, code]);
    }
  });
  it("registryPayApps returns every snapshot app offline", async () => {
    expect((await snapshotSource.load()).apps).toHaveLength(SNAPSHOT.apps.length);
    expect(registryPayApps("android").map((a) => a.id)).toEqual(SNAPSHOT.apps.map((a) => a.app_id));
  });
  it("toPayApp maps platform flags and nulls", async () => {
    const src = createMockSource({
      updated_at: "x",
      stale: false,
      apps: [
        {
          app_id: "zz",
          name: "Z",
          logo: null,
          bank_code: null,
          bin: null,
          autofill: { android: true, ios: false },
          ios_scheme: null,
          android_package: null,
        },
      ],
    });
    const dto = (await src.load()).apps[0];
    expect(toPayApp(dto, "android")).toMatchObject({
      id: "zz",
      short: "ZZ",
      supportsAutofill: true,
      deeplinkCode: "zz",
    });
    expect(toPayApp(dto, "ios").supportsAutofill).toBe(false);
    expect(toPayApp(dto, "ios").scheme).toBeUndefined();
  });
});

describe("live rows without launch data (#488)", () => {
  const live = (id: string) => ({
    updated_at: "2026-11-26T00:00:00Z",
    stale: false,
    apps: [
      {
        app_id: id,
        name: id,
        logo: null,
        bank_code: null,
        bin: null,
        autofill: { android: false, ios: false },
        ios_scheme: null,
        android_package: null,
      },
    ],
  });

  it("takes Techcombank's Android package and iOS scheme from the bundled snapshot", () => {
    const [tcb] = registryPayApps("android", live("tcb"));
    expect(tcb.androidPackage).toBe("vn.com.techcombank.bb.app");
    expect(tcb.scheme).toBe("tcb");
  });

  it("leaves an app unknown to the snapshot without a package", () => {
    const [zzz] = registryPayApps("android", live("zzz"));
    expect(zzz.androidPackage).toBeUndefined();
  });
});
