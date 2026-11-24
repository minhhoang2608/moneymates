import { extractTextFromImage } from "expo-text-extractor";

import { createNativeTextRecognizer } from "../nativeTextRecognizer";

describe("createNativeTextRecognizer", () => {
  it("passes the uri through to the library", async () => {
    (extractTextFromImage as jest.Mock).mockResolvedValueOnce(["a"]);
    expect(await createNativeTextRecognizer().recognize("file:///a.jpg")).toEqual(["a"]);
    expect(extractTextFromImage).toHaveBeenCalledWith("file:///a.jpg");
  });
});
