import { formatGroupDates, groupErrorMessage, memberLabel } from "../format";

describe("group format helpers", () => {
  it("formats date ranges", () => {
    expect(formatGroupDates("2026-12-01", "2026-12-04")).toBe("01–04/12");
    expect(formatGroupDates("2026-11-28", "2026-12-03")).toBe("28/11–03/12");
    expect(formatGroupDates(null, null)).toBe("không giới hạn ngày");
    expect(formatGroupDates("2026-12-01", null)).toBe("từ 01/12");
  });

  it("labels Tôi after the display name", () => {
    expect(memberLabel({ displayName: "Hoàng", isMe: true })).toBe("Hoàng (Tôi)");
    expect(memberLabel({ displayName: "An", isMe: false })).toBe("An");
  });

  it("maps error codes to Vietnamese", () => {
    expect(groupErrorMessage("name_required")).toBe("Vui lòng nhập tên nhóm");
  });
});
