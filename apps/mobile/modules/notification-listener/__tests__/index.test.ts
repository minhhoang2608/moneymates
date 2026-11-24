const mockNative = {
  isAccessGranted: jest.fn(async () => true),
  openAccessSettings: jest.fn(async () => {}),
  setAllowedPackages: jest.fn(),
  addListener: jest.fn(),
};
let emit: (e: unknown) => void = () => {};
const remove = jest.fn();
const mockLoad = jest.fn();

jest.mock("../src/native", () => ({ loadNative: () => mockLoad() }));

const TPB = "com.tpb.mb.gprsandroid";
const ev = (packageName: string) => ({ packageName, title: "t", text: "x", postedAt: 1 });

function load() {
  jest.resetModules();
  return require("../index") as typeof import("../index");
}

beforeEach(() => {
  jest.clearAllMocks();
  mockLoad.mockReturnValue(mockNative);
  mockNative.addListener.mockImplementation((_n: string, h: (e: unknown) => void) => {
    emit = h;
    return { remove };
  });
});

describe("android", () => {
  it("delivers only allowed packages", () => {
    const { subscribe } = load();
    const h = jest.fn();
    subscribe(h, [TPB]);
    emit(ev("com.VCB"));
    expect(h).not.toHaveBeenCalled();
    emit(ev(TPB));
    expect(h).toHaveBeenCalledWith(ev(TPB));
  });
  it("sets union of packages and recomputes on unsubscribe, removes listener at the end", () => {
    const { subscribe } = load();
    const u1 = subscribe(jest.fn(), [TPB]);
    const u2 = subscribe(jest.fn(), ["com.VCB"]);
    expect(mockNative.setAllowedPackages).toHaveBeenLastCalledWith([TPB, "com.VCB"]);
    expect(mockNative.addListener).toHaveBeenCalledTimes(1);
    u1();
    expect(mockNative.setAllowedPackages).toHaveBeenLastCalledWith(["com.VCB"]);
    expect(remove).not.toHaveBeenCalled();
    u2();
    expect(remove).toHaveBeenCalledTimes(1);
    expect(mockNative.setAllowedPackages).toHaveBeenLastCalledWith([]);
  });
  it("proxies access calls", async () => {
    const m = load();
    expect(await m.isAccessGranted()).toBe(true);
    await m.openAccessSettings();
    expect(mockNative.openAccessSettings).toHaveBeenCalled();
  });
});

describe("no native module (iOS)", () => {
  it("degrades gracefully", async () => {
    mockLoad.mockReturnValue(null);
    const m = load();
    expect(await m.isAccessGranted()).toBe(false);
    await expect(m.openAccessSettings()).resolves.toBeUndefined();
    const un = m.subscribe(jest.fn(), [TPB]);
    expect(() => un()).not.toThrow();
    expect(mockNative.addListener).not.toHaveBeenCalled();
  });
});
