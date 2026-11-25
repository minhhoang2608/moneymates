import { allowedPackagesFor } from "../allowedPackages";

describe("allowedPackagesFor", () => {
  it("maps enabled ids to packages without duplicates or undefined", () => {
    const pk = allowedPackagesFor(["tpb", "tpb", "zalopay", "nope"]);
    expect(pk).toContain("com.tpb.mb.gprsandroid");
    expect(pk.filter((p) => p === "com.tpb.mb.gprsandroid")).toHaveLength(1);
    expect(pk.every((p) => typeof p === "string" && p.length > 0)).toBe(true);
  });
  it("excludes disabled apps", () => {
    expect(allowedPackagesFor(["tpb"])).not.toContain("com.VCB");
  });
});
