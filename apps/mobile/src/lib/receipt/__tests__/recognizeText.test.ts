import { extractTextFromImage } from "expo-text-extractor";

import fixture from "../../../../e2e/fixtures/receipt-text.json";
import { parseReceipt } from "../parseReceipt";
import { recognizeText } from "../recognizeText";

const mockExtract = extractTextFromImage as jest.Mock;

beforeEach(() => {
  mockExtract.mockReset().mockResolvedValue([]);
});

describe("recognizeText", () => {
  it("returns lines in order with diacritics intact", async () => {
    const lines = ["Chuyển tiền thành công", "Số tiền: 55.000 VND"];
    mockExtract.mockResolvedValue(lines);
    expect(await recognizeText("file:///a.jpg")).toEqual(lines);
    expect(mockExtract).toHaveBeenCalledWith("file:///a.jpg");
  });

  it("returns [] for a blank image", async () => {
    expect(await recognizeText("file:///a.jpg")).toEqual([]);
    mockExtract.mockResolvedValue(["  ", "", "\n"]);
    expect(await recognizeText("file:///a.jpg")).toEqual([]);
  });

  it("splits multi-line strings, drops empty lines and normalises to NFC", async () => {
    mockExtract.mockResolvedValue(["a\n\n b ", "Chuyển".normalize("NFD")]);
    const out = await recognizeText("file:///a.jpg");
    expect(out).toEqual(["a", "b", "Chuyển"]);
    expect(out[2]).toBe("Chuyển".normalize("NFC"));
  });

  it("never throws", async () => {
    mockExtract.mockRejectedValue(new Error("unreadable"));
    expect(await recognizeText("file:///a.jpg")).toEqual([]);
    mockExtract.mockImplementation(() => {
      throw new Error("sync");
    });
    expect(await recognizeText("file:///a.jpg")).toEqual([]);
    mockExtract.mockReset().mockResolvedValue("nope");
    expect(await recognizeText("file:///a.jpg")).toEqual([]);
  });

  it("returns [] for an empty uri without calling the library", async () => {
    expect(await recognizeText("  ")).toEqual([]);
    expect(mockExtract).not.toHaveBeenCalled();
  });

  it("makes no network call", async () => {
    const f = jest.spyOn(global, "fetch").mockImplementation(async () => new Response());
    const xhr = { open: jest.fn() };
    const prev = (global as { XMLHttpRequest?: unknown }).XMLHttpRequest;
    (global as { XMLHttpRequest?: unknown }).XMLHttpRequest = function () {
      xhr.open();
    };
    mockExtract.mockResolvedValueOnce(["x"]);
    await recognizeText("file:///a.jpg");
    await recognizeText("file:///a.jpg");
    mockExtract.mockRejectedValueOnce(new Error("e"));
    await recognizeText("file:///a.jpg");
    expect(f).not.toHaveBeenCalled();
    expect(xhr.open).not.toHaveBeenCalled();
    f.mockRestore();
    (global as { XMLHttpRequest?: unknown }).XMLHttpRequest = prev;
  });

  describe("E2E fake", () => {
    const old = process.env.EXPO_PUBLIC_E2E;
    beforeAll(() => {
      process.env.EXPO_PUBLIC_E2E = "1";
    });
    afterAll(() => {
      if (old === undefined) delete process.env.EXPO_PUBLIC_E2E;
      else process.env.EXPO_PUBLIC_E2E = old;
    });

    it("returns fixture lines for the fixture image only", async () => {
      const lines = await recognizeText(fixture.imageUri);
      expect(lines).toEqual(fixture.lines);
      expect(parseReceipt(lines).amount).toBe(55000);
      expect(await recognizeText("file:///other.jpg")).toEqual([]);
      expect(mockExtract).not.toHaveBeenCalled();
    });
  });
});
