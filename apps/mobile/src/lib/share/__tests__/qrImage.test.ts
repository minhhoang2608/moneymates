import * as MediaLibrary from "expo-media-library/legacy";
import * as Sharing from "expo-sharing";

import { saveQrToGallery, shareQr } from "../qrImage";

beforeEach(() => jest.clearAllMocks());

describe("qrImage", () => {
  it("saves to the gallery when permission is granted", async () => {
    expect(await saveQrToGallery("AAAA")).toBe("saved");
    expect(MediaLibrary.saveToLibraryAsync).toHaveBeenCalledTimes(1);
    expect(MediaLibrary.createAssetAsync).not.toHaveBeenCalled();
  });

  it("skips saving when permission is denied", async () => {
    jest.mocked(MediaLibrary.requestPermissionsAsync).mockResolvedValueOnce({ granted: false } as never);
    expect(await saveQrToGallery("AAAA")).toBe("denied");
    expect(MediaLibrary.saveToLibraryAsync).not.toHaveBeenCalled();
  });

  it("shares a png file", async () => {
    expect(await shareQr("AAAA")).toBe("shared");
    expect(Sharing.shareAsync).toHaveBeenCalledWith(expect.stringMatching(/\.png$/), { mimeType: "image/png" });
  });

  it("reports when sharing is unavailable", async () => {
    jest.mocked(Sharing.isAvailableAsync).mockResolvedValueOnce(false);
    expect(await shareQr("AAAA")).toBe("unavailable");
    expect(Sharing.shareAsync).not.toHaveBeenCalled();
  });
});
