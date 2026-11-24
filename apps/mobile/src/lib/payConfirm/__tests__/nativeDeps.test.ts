import * as Clipboard from "expo-clipboard";
import * as Linking from "expo-linking";
import * as MediaLibrary from "expo-media-library/legacy";

import { createNativeDeps } from "../nativeDeps";

jest.mock("expo-clipboard", () => ({ setStringAsync: jest.fn(async () => true) }));
jest.mock("expo-linking", () => ({ openURL: jest.fn(async () => true) }));
jest.mock("expo-media-library/legacy", () => ({
  requestPermissionsAsync: jest.fn(async () => ({ granted: false })),
  saveToLibraryAsync: jest.fn(async () => {}),
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

  it("skips the image when permission is denied, saves it when granted", async () => {
    const d = createNativeDeps(async () => "AAAA");
    await d.saveQrImage();
    expect(MediaLibrary.saveToLibraryAsync).not.toHaveBeenCalled();
    jest.mocked(MediaLibrary.requestPermissionsAsync).mockResolvedValueOnce({ granted: true } as never);
    await d.saveQrImage();
    expect(MediaLibrary.saveToLibraryAsync).toHaveBeenCalledTimes(1);
  });
});
