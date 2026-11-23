import * as FileSystem from "expo-file-system";
import * as ImagePicker from "expo-image-picker";

import { persistAttachment, photoPicker } from "../photoPicker";

const launch = ImagePicker.launchImageLibraryAsync as jest.Mock;
const permission = ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock;

afterEach(() => jest.restoreAllMocks());

describe("photoPicker.pick", () => {
  it("copies the picked file into the document directory and returns the new URI", async () => {
    permission.mockResolvedValueOnce({ granted: true });
    launch.mockResolvedValueOnce({
      canceled: false,
      assets: [{ uri: "file:///cache/ImagePicker/abc.PNG?x=1" }],
    });
    const copy = jest.spyOn(FileSystem.File.prototype, "copy");

    const uri = await photoPicker.pick();

    expect(copy).toHaveBeenCalledTimes(1);
    expect(uri).toMatch(/^file:\/\/\/doc\/attachments\/[0-9a-f-]{36}\.png$/);
    expect(uri).not.toContain("ImagePicker");
  });

  it("returns null on cancel without copying", async () => {
    permission.mockResolvedValueOnce({ granted: true });
    launch.mockResolvedValueOnce({ canceled: true, assets: null });
    const copy = jest.spyOn(FileSystem.File.prototype, "copy");
    expect(await photoPicker.pick()).toBeNull();
    expect(copy).not.toHaveBeenCalled();
  });

  it("returns null when permission is denied without opening the picker", async () => {
    permission.mockResolvedValueOnce({ granted: false });
    launch.mockClear();
    expect(await photoPicker.pick()).toBeNull();
    expect(launch).not.toHaveBeenCalled();
  });
});

describe("persistAttachment", () => {
  afterEach(() => {
    delete process.env.EXPO_PUBLIC_E2E;
  });

  it("copies the file into attachments/", () => {
    const copy = jest.spyOn(FileSystem.File.prototype, "copy");
    expect(persistAttachment("file:///cache/bill.jpg")).toMatch(/^file:\/\/\/doc\/attachments\/[0-9a-f-]{36}\.jpg$/);
    expect(copy).toHaveBeenCalledTimes(1);
  });

  it("returns the uri unchanged in E2E mode", () => {
    process.env.EXPO_PUBLIC_E2E = "1";
    const copy = jest.spyOn(FileSystem.File.prototype, "copy");
    expect(persistAttachment("file:///e2e/bill.jpg")).toBe("file:///e2e/bill.jpg");
    expect(copy).not.toHaveBeenCalled();
  });
});
