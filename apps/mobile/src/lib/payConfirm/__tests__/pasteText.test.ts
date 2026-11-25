import { buildPasteText } from "../pasteText";

describe("buildPasteText", () => {
  it("builds three lines", () => {
    expect(buildPasteText({ account: "0123456789", amount: 55000, note: "PHO HOA BAN 12" })).toBe(
      "STK: 0123456789\nSố tiền: 55.000đ\nNội dung: PHO HOA BAN 12",
    );
  });
  it("formats large amounts", () => {
    expect(buildPasteText({ account: "1", amount: 1200000, note: "x" })).toContain("Số tiền: 1.200.000đ");
  });
  it("rejects a non-integer amount", () => {
    expect(() => buildPasteText({ account: "1", amount: 10.5, note: "x" })).toThrow();
  });
  it("drops an empty note", () => {
    expect(buildPasteText({ account: "1", amount: 1000, note: "  " })).toBe("STK: 1\nSố tiền: 1.000đ");
  });
  it("drops a missing account", () => {
    expect(buildPasteText({ amount: 1000, note: "a" })).toBe("Số tiền: 1.000đ\nNội dung: a");
  });
});
