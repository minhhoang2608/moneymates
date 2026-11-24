import {
  ensurePermission,
  getPermissionState,
  mapState,
  requestPermission,
  setPermissionAdapter,
  type PermissionAdapter,
  type PermissionKind,
  type PermissionResponse,
} from "..";

const KINDS: PermissionKind[] = ["camera", "photos", "microphone"];

function fake(get: PermissionResponse, request: PermissionResponse) {
  const a = {
    get: jest.fn(async () => get),
    request: jest.fn(async () => request),
    openSettings: jest.fn(async () => {}),
  } satisfies PermissionAdapter;
  setPermissionAdapter(a);
  return a;
}

afterEach(() => setPermissionAdapter(null));

describe("mapState", () => {
  it.each(KINDS)("%s: undetermined / granted / denied", async (kind) => {
    fake({ status: "undetermined", granted: false }, { status: "granted", granted: true });
    expect(await getPermissionState(kind)).toBe("not_asked");
    fake({ status: "granted", granted: true }, {});
    expect(await getPermissionState(kind)).toBe("granted");
    fake({ status: "denied", granted: false, canAskAgain: false }, {});
    expect(await getPermissionState(kind)).toBe("denied");
  });

  it("iOS limited photo access counts as granted", () => {
    expect(mapState({ status: "granted", granted: true, accessPrivileges: "limited" })).toBe("granted");
    expect(mapState({ status: "denied", granted: false, accessPrivileges: "none" })).toBe("denied");
  });
});

describe("ensurePermission", () => {
  it("not_asked: requests exactly once and returns the result", async () => {
    const a = fake({ status: "undetermined" }, { status: "granted", granted: true });
    expect(await ensurePermission("camera")).toBe("granted");
    expect(a.request).toHaveBeenCalledTimes(1);
  });

  it("not_asked then user denies: returns denied", async () => {
    const a = fake({ status: "undetermined" }, { status: "denied", granted: false });
    expect(await ensurePermission("camera")).toBe("denied");
    expect(a.request).toHaveBeenCalledTimes(1);
  });

  it("granted: no request", async () => {
    const a = fake({ status: "granted", granted: true }, {});
    expect(await ensurePermission("microphone")).toBe("granted");
    expect(a.request).not.toHaveBeenCalled();
  });

  it("denied: no request", async () => {
    const a = fake({ status: "denied", granted: false }, {});
    expect(await ensurePermission("photos")).toBe("denied");
    expect(a.request).not.toHaveBeenCalled();
  });

  it("adapter errors map to denied", async () => {
    setPermissionAdapter({
      get: jest.fn(async () => {
        throw new Error("native");
      }),
      request: jest.fn(),
      openSettings: jest.fn(),
    });
    expect(await getPermissionState("camera")).toBe("denied");
    expect(await requestPermission("camera")).toBe("denied");
  });
});
