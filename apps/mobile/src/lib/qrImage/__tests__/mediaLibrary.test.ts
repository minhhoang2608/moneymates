import { mapPermission } from "../mediaLibrary";

describe("mapPermission", () => {
  it("maps limited, full and denied access", () => {
    expect(mapPermission("ios", { granted: true, accessPrivileges: "limited" }).access).toBe("limited");
    expect(mapPermission("ios", { granted: true, accessPrivileges: "all" }).access).toBe("read-write");
    expect(mapPermission("android", { granted: true }).access).toBe("read-write");
    expect(mapPermission("ios", { granted: false }).access).toBe("add-only");
  });
});
