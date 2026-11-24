import * as Clipboard from "expo-clipboard";
import * as Linking from "expo-linking";
import * as MediaLibrary from "expo-media-library/legacy";

import { openIntentUri, sharePng } from "../../../../modules/bank-hand-off";
import { createNativeDeps } from "../nativeDeps";

jest.mock("expo-clipboard", () => ({ setStringAsync: jest.fn(async () => true) }));
jest.mock("expo-linking", () => ({ openURL: jest.fn(async () => true) }));
jest.mock("expo-media-library/legacy", () => ({
  requestPermissionsAsync: jest.fn(async () => ({ granted: false })),
  createAssetAsync: jest.fn(async () => ({ id: "a1" })),
  getAlbumAsync: jest.fn(async () => null),
  createAlbumAsync: jest.fn(async () => ({})),
  addAssetsToAlbumAsync: jest.fn(async () => true),
}));
jest.mock("expo-file-system", () => ({
  Paths: { cache: "/cache" },
  Directory: class {
    create() {}
  },
  File: class {
    uri = "file:///cache/handoff/qr.png";
    create() {}
    write() {}
  },
}));

describe("nativeDeps", () => {
  it("opens urls and copies text", async () => {
    const d = createNativeDeps(async () => null);
    await d.openUrl("hydro://");
    await d.setClipboard("1 2");
    expect(Linking.openURL).toHaveBeenCalledWith("hydro://");
    expect(Clipboard.setStringAsync).toHaveBeenCalledWith("1 2");
  });

  it("skips the image when permission is denied", async () => {
    const d = createNativeDeps(async () => "AAAA");
    await d.saveQrImage();
    expect(MediaLibrary.createAssetAsync).not.toHaveBeenCalled();
  });

  it("creates the MoneyMates album when missing", async () => {
    jest.mocked(MediaLibrary.requestPermissionsAsync).mockResolvedValueOnce({ granted: true } as never);
    await createNativeDeps(async () => "AAAA").saveQrImage();
    expect(MediaLibrary.getAlbumAsync).toHaveBeenCalledWith("MoneyMates");
    expect(MediaLibrary.createAlbumAsync).toHaveBeenCalledWith("MoneyMates", { id: "a1" }, false);
    expect(MediaLibrary.addAssetsToAlbumAsync).not.toHaveBeenCalled();
  });

  it("reuses the album when present", async () => {
    jest.mocked(MediaLibrary.requestPermissionsAsync).mockResolvedValueOnce({ granted: true } as never);
    jest.mocked(MediaLibrary.getAlbumAsync).mockResolvedValueOnce({ id: "al" } as never);
    jest.mocked(MediaLibrary.createAlbumAsync).mockClear();
    await createNativeDeps(async () => "AAAA").saveQrImage();
    expect(MediaLibrary.addAssetsToAlbumAsync).toHaveBeenCalledWith([{ id: "a1" }], { id: "al" }, false);
    expect(MediaLibrary.createAlbumAsync).not.toHaveBeenCalled();
  });

  it("shares to a package and opens intents through the native module", async () => {
    const d = createNativeDeps(async () => "AAAA");
    await d.shareToPackage("com.x");
    await d.openIntent("intent://#Intent;package=com.x;end");
    expect(sharePng).toHaveBeenCalledWith("AAAA", "com.x");
    expect(openIntentUri).toHaveBeenCalledWith("intent://#Intent;package=com.x;end");
    await expect(createNativeDeps(async () => null).shareToPackage("com.x")).rejects.toThrow();
  });
});
