import * as Clipboard from "expo-clipboard";
import * as ImageManipulator from "expo-image-manipulator";
import * as Linking from "expo-linking";
import * as MediaLibrary from "expo-media-library/legacy";

import { Platform } from "react-native";

import { openIntentUri, shareMediaImage, sharePng } from "../../../../modules/bank-hand-off";
import { createNativeDeps } from "../nativeDeps";

jest.mock("expo-clipboard", () => ({ setStringAsync: jest.fn(async () => true) }));
jest.mock("expo-linking", () => ({ openURL: jest.fn(async () => true) }));
jest.mock("expo-media-library/legacy", () => ({
  requestPermissionsAsync: jest.fn(async () => ({ granted: false })),
  getPermissionsAsync: jest.fn(async () => ({ granted: false })),
  createAssetAsync: jest.fn(async () => ({ id: "a1", filename: "q.jpg" })),
  getAlbumAsync: jest.fn(async () => null),
  createAlbumAsync: jest.fn(async () => ({ id: "al" })),
  addAssetsToAlbumAsync: jest.fn(async () => true),
  getAssetsAsync: jest.fn(async () => ({ assets: [] })),
  MediaType: { photo: "photo" },
  SortBy: { modificationTime: "modificationTime" },
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

  it("first use: creates the album and returns the id of the photo moved into it (not the deleted original)", async () => {
    jest.mocked(MediaLibrary.requestPermissionsAsync).mockResolvedValueOnce({ granted: true } as never);
    jest.mocked(MediaLibrary.getAssetsAsync).mockResolvedValueOnce({
      assets: [
        { id: "other", filename: "x.jpg" },
        { id: "moved", filename: "q.jpg" },
      ],
    } as never);
    const saved = await createNativeDeps(async () => "AAAA").saveQrImage();
    expect(MediaLibrary.getAlbumAsync).toHaveBeenCalledWith("MoneyMates");
    expect(MediaLibrary.createAlbumAsync).toHaveBeenCalledWith("MoneyMates", { id: "a1", filename: "q.jpg" }, false);
    expect(saved).toEqual({ assetId: "moved", access: "read-write" });
  });

  it("album present: creates the photo straight in the album and keeps that id", async () => {
    jest.mocked(MediaLibrary.requestPermissionsAsync).mockResolvedValueOnce({ granted: true } as never);
    jest.mocked(MediaLibrary.getAlbumAsync).mockResolvedValueOnce({ id: "al" } as never);
    jest.mocked(MediaLibrary.createAlbumAsync).mockClear();
    jest.mocked(MediaLibrary.createAssetAsync).mockResolvedValueOnce({ id: "in-album", filename: "q.jpg" } as never);
    const saved = await createNativeDeps(async () => "AAAA").saveQrImage();
    expect(MediaLibrary.createAssetAsync).toHaveBeenLastCalledWith(expect.any(String), { id: "al" });
    expect(MediaLibrary.addAssetsToAlbumAsync).not.toHaveBeenCalled();
    expect(MediaLibrary.createAlbumAsync).not.toHaveBeenCalled();
    expect(saved).toEqual({ assetId: "in-album", access: "read-write" });
  });

  it("shares the album QR as the gallery photo when there is one", async () => {
    jest.mocked(sharePng).mockClear();
    await createNativeDeps(async () => "AAAA").shareToPackage("com.x", "42");
    expect(shareMediaImage).toHaveBeenCalledWith("42", "com.x");
    expect(sharePng).not.toHaveBeenCalled();
  });

  it("falls back to a private JPEG copy when sharing the album QR fails", async () => {
    jest.mocked(shareMediaImage).mockRejectedValueOnce(new Error("no"));
    jest.mocked(sharePng).mockClear();
    jest
      .mocked(ImageManipulator.manipulateAsync)
      .mockResolvedValueOnce({ uri: "file:///q.jpg", base64: "JPEG" } as never);
    await createNativeDeps(async () => "AAAA").shareToPackage("com.x", "42");
    expect(sharePng).toHaveBeenCalledWith("JPEG", "com.x", "image/jpeg");
  });

  it("shares to a package and opens intents through the native module", async () => {
    const d = createNativeDeps(async () => "AAAA");
    jest
      .mocked(ImageManipulator.manipulateAsync)
      .mockResolvedValueOnce({ uri: "file:///q.jpg", base64: "JPEG" } as never);
    await d.shareToPackage("com.x");
    await d.openIntent("intent://#Intent;package=com.x;end");
    expect(sharePng).toHaveBeenCalledWith("JPEG", "com.x", "image/jpeg");
    expect(openIntentUri).toHaveBeenCalledWith("intent://#Intent;package=com.x;end");
    await expect(createNativeDeps(async () => null).shareToPackage("com.x")).rejects.toThrow();
  });

  it("saves the album QR as a JPEG", async () => {
    jest.mocked(MediaLibrary.requestPermissionsAsync).mockResolvedValueOnce({ granted: true } as never);
    jest
      .mocked(ImageManipulator.manipulateAsync)
      .mockResolvedValueOnce({ uri: "file:///q.jpg", base64: "JPEG" } as never);
    await createNativeDeps(async () => "AAAA").saveQrImage();
    expect(ImageManipulator.manipulateAsync).toHaveBeenLastCalledWith(expect.any(String), [], {
      compress: 1,
      format: "jpeg",
      base64: true,
    });
    expect(MediaLibrary.createAssetAsync).toHaveBeenCalledWith("file:///q.jpg");
  });

  it("returns the asset id on Android", async () => {
    jest.mocked(MediaLibrary.requestPermissionsAsync).mockResolvedValueOnce({ granted: true } as never);
    expect(await createNativeDeps(async () => "AAAA").saveQrImage()).toEqual({ assetId: "a1", access: "read-write" });
  });

  describe("iOS", () => {
    const original = Platform.OS;
    beforeEach(() => {
      Platform.OS = "ios";
    });
    afterEach(() => {
      Platform.OS = original;
    });

    it("reports limited access", async () => {
      jest
        .mocked(MediaLibrary.requestPermissionsAsync)
        .mockResolvedValueOnce({ granted: true, accessPrivileges: "limited" } as never);
      expect(await createNativeDeps(async () => "AAAA").saveQrImage()).toEqual({ assetId: "a1", access: "limited" });
    });

    it("saves with add-only access when read/write is denied but write-only is granted", async () => {
      jest.mocked(MediaLibrary.getPermissionsAsync).mockResolvedValueOnce({ granted: true } as never);
      expect(await createNativeDeps(async () => "AAAA").saveQrImage()).toEqual({ assetId: "a1", access: "add-only" });
      expect(MediaLibrary.getPermissionsAsync).toHaveBeenCalledWith(true);
    });

    it("skips when nothing is granted", async () => {
      jest.mocked(MediaLibrary.createAssetAsync).mockClear();
      expect(await createNativeDeps(async () => "AAAA").saveQrImage()).toBeNull();
      expect(MediaLibrary.createAssetAsync).not.toHaveBeenCalled();
    });
  });
});
