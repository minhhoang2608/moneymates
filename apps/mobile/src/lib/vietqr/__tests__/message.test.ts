import { buildTransferMessage, toAsciiText } from "../message";

describe("toAsciiText", () => {
  it("strips diacritics and punctuation", () => {
    expect(toAsciiText("Đà Lạt 12/2026")).toBe("Da Lat 12 2026");
    expect(toAsciiText("đông ĐÚC")).toBe("dong DUC");
    expect(toAsciiText("Hi 🎉!! there")).toBe("Hi there");
  });
});

describe("buildTransferMessage", () => {
  it("truncates the group first", () => {
    const m = buildTransferMessage("Chuyến đi Phú Quốc tháng mười hai", "Nguyễn Bình");
    expect(m).toBe("Chuyen di Phu Nguyen Binh");
    expect(m).toHaveLength(25);
  });
  it("keeps short values intact", () => {
    expect(buildTransferMessage("Đà Lạt 12/2026", "An")).toBe("Da Lat 12 2026 An");
  });
  it("caps a very long member name", () => {
    const m = buildTransferMessage("Nhóm", "Nguyễn ".repeat(10));
    expect(m!.length).toBeLessThanOrEqual(25);
    expect(buildTransferMessage(undefined, "x".repeat(60))!.length).toBe(25);
    expect(buildTransferMessage("g".repeat(60))!.length).toBe(25);
  });
  it("returns null when both empty", () => {
    expect(buildTransferMessage()).toBeNull();
    expect(buildTransferMessage("", " ! ")).toBeNull();
  });
});
