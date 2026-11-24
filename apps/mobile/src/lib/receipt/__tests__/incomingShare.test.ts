import { emitE2eSharedImage, getE2eShareSource } from "@/e2e/incomingShare";

import { firstImageUri, subscribeIncomingImage, type ShareSource, type SharedPayload } from "../incomingShare";

const flush = () => new Promise((r) => setImmediate(r));
const img = (path: string): SharedPayload => ({ files: [{ path, mimeType: "image/png" }] });

function fakeSource(initial: SharedPayload = null) {
  let listener: ((p: SharedPayload) => void) | null = null;
  const source: ShareSource = {
    getInitial: jest.fn(async () => initial),
    onShare: jest.fn((cb) => {
      listener = cb;
      return () => {
        listener = null;
      };
    }),
    reset: jest.fn(),
  };
  return { source, emit: (p: SharedPayload) => listener?.(p), hasListener: () => listener !== null };
}

describe("subscribeIncomingImage", () => {
  it("delivers the cold-start image once and resets", async () => {
    const { source } = fakeSource(img("file:///a.png"));
    const cb = jest.fn();
    subscribeIncomingImage(cb, { source });
    await flush();
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledWith("file:///a.png");
    expect(source.reset).toHaveBeenCalled();
  });

  it("delivers each new warm-start share", async () => {
    const { source, emit } = fakeSource();
    const cb = jest.fn();
    subscribeIncomingImage(cb, { source });
    await flush();
    emit(img("file:///a.png"));
    emit(img("file:///b.png"));
    expect(cb.mock.calls).toEqual([["file:///a.png"], ["file:///b.png"]]);
  });

  it("dedupes the same uri from cold and warm start", async () => {
    const { source, emit } = fakeSource(img("file:///a.png"));
    const cb = jest.fn();
    subscribeIncomingImage(cb, { source });
    emit(img("file:///a.png"));
    await flush();
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("ignores non-image and empty payloads", async () => {
    const { source, emit } = fakeSource();
    const cb = jest.fn();
    subscribeIncomingImage(cb, { source });
    await flush();
    emit(null);
    emit({ files: [] });
    emit({ files: [{ path: "file:///v.mp4", mimeType: "video/mp4" }] });
    emit({ files: [{ path: null, mimeType: "image/png" }] });
    expect(cb).not.toHaveBeenCalled();
    expect(firstImageUri({ files: [{ path: "x", mimeType: "text/plain" }] })).toBeNull();
  });

  it("stops delivering after unsubscribe, even for a pending initial read", async () => {
    const { source, emit, hasListener } = fakeSource(img("file:///a.png"));
    const cb = jest.fn();
    const off = subscribeIncomingImage(cb, { source });
    off();
    emit(img("file:///b.png"));
    await flush();
    expect(hasListener()).toBe(false);
    expect(cb).not.toHaveBeenCalled();
  });

  it("never navigates", async () => {
    const router = { push: jest.fn(), replace: jest.fn(), navigate: jest.fn() };
    jest.doMock("expo-router", () => ({ router, useRouter: () => router }));
    const { source, emit } = fakeSource(img("file:///a.png"));
    subscribeIncomingImage(jest.fn(), { source });
    emit(img("file:///b.png"));
    await flush();
    expect(router.push).not.toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it("the E2E fake emits the fixture uri", () => {
    const cb = jest.fn();
    subscribeIncomingImage(cb, { source: getE2eShareSource() });
    emitE2eSharedImage();
    expect(cb).toHaveBeenCalledWith("file:///data/local/tmp/bill-share.jpg");
  });

  it("default native source is inert without the native module", async () => {
    const cb = jest.fn();
    const off = subscribeIncomingImage(cb);
    await flush();
    off();
    expect(cb).not.toHaveBeenCalled();
  });
});
