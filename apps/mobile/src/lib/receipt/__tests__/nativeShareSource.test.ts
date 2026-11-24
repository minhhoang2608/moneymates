const mockMod = {
  getShareIntent: jest.fn(() => ""),
  clearShareIntent: jest.fn(async () => undefined),
  addListener: jest.fn(),
};
const mockRemove = jest.fn();
const mockParse = jest.fn((v: unknown) => ({ files: [{ path: String(v), mimeType: "image/png" }] }));

jest.mock("expo-share-intent", () => ({
  get ShareIntentModule() {
    return mockMod;
  },
  getShareExtensionKey: () => "moneymatesShareKey",
  parseShareIntent: (...a: unknown[]) => mockParse(...(a as [unknown])),
}));

import { createNativeShareSource } from "../nativeShareSource";

beforeEach(() => {
  jest.clearAllMocks();
  mockMod.addListener.mockReturnValue({ remove: mockRemove });
  mockMod.getShareIntent.mockReturnValue("");
});

describe("createNativeShareSource (with the native module)", () => {
  it("getInitial reads the pending share and parses it", async () => {
    mockMod.getShareIntent.mockReturnValue("file:///a.png");
    const payload = await createNativeShareSource().getInitial();
    expect(mockMod.getShareIntent).toHaveBeenCalledWith("");
    expect(mockParse).toHaveBeenCalledWith("file:///a.png", {});
    expect(payload).toEqual({ files: [{ path: "file:///a.png", mimeType: "image/png" }] });
  });

  it("getInitial is null when nothing is pending or the module throws", async () => {
    expect(await createNativeShareSource().getInitial()).toBeNull();
    mockMod.getShareIntent.mockImplementation(() => {
      throw new Error("boom");
    });
    expect(await createNativeShareSource().getInitial()).toBeNull();
  });

  it("onShare parses e.value, refreshes, and unsubscribes with sub.remove", () => {
    const cb = jest.fn();
    const off = createNativeShareSource().onShare(cb);
    expect(mockMod.addListener).toHaveBeenCalledWith("onChange", expect.any(Function));
    expect(mockMod.getShareIntent).toHaveBeenCalledWith("");
    mockMod.addListener.mock.calls[0][1]({ value: "file:///b.png" });
    expect(mockParse).toHaveBeenCalledWith("file:///b.png", {});
    expect(cb).toHaveBeenCalledWith({ files: [{ path: "file:///b.png", mimeType: "image/png" }] });
    off();
    expect(mockRemove).toHaveBeenCalled();
  });

  it("onShare passes null when parsing throws", () => {
    mockParse.mockImplementationOnce(() => {
      throw new Error("bad");
    });
    const cb = jest.fn();
    createNativeShareSource().onShare(cb);
    mockMod.addListener.mock.calls[0][1]({ value: "x" });
    expect(cb).toHaveBeenCalledWith(null);
  });

  it("reset clears the share intent with the extension key", () => {
    createNativeShareSource().reset();
    expect(mockMod.clearShareIntent).toHaveBeenCalledWith("moneymatesShareKey");
  });
});
