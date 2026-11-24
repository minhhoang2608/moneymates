import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { emitE2eSharedImage, getE2eShareSource } from "@/e2e/incomingShare";

import {
  DUPLICATE_WINDOW_MS,
  firstImageUri,
  subscribeIncomingImage,
  type ShareSource,
  type SharedPayload,
} from "../incomingShare";

const mockRouter = { push: jest.fn(), replace: jest.fn(), navigate: jest.fn(), back: jest.fn() };
jest.mock("expo-router", () => ({ router: mockRouter, useRouter: () => mockRouter, usePathname: () => "/" }));

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

  it("delivers the same uri again after the duplicate window", async () => {
    const { source, emit } = fakeSource();
    const cb = jest.fn();
    let t = 1000;
    subscribeIncomingImage(cb, { source, now: () => t });
    await flush();
    emit(img("file:///a.png"));
    t += DUPLICATE_WINDOW_MS + 1;
    emit(img("file:///a.png"));
    expect(cb).toHaveBeenCalledTimes(2);
  });

  it("never navigates", async () => {
    const { source, emit } = fakeSource(img("file:///a.png"));
    subscribeIncomingImage(jest.fn(), { source });
    emit(img("file:///b.png"));
    await flush();
    expect(mockRouter.push).not.toHaveBeenCalled();
    expect(mockRouter.replace).not.toHaveBeenCalled();
    expect(mockRouter.navigate).not.toHaveBeenCalled();
  });

  it("neither delivery module imports expo-router", () => {
    for (const f of ["../incomingShare.ts", "../nativeShareSource.ts", "../currentPath.ts"]) {
      expect(readFileSync(resolve(__dirname, f), "utf8")).not.toMatch(/(from|require\()\s*["']expo-router/);
    }
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
