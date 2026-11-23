import { formatEndedOn, formatLastUsed, targetName } from "../format";
import { NOW } from "../testFixtures";

const ago = (min: number) => new Date(NOW.getTime() - min * 60_000).toISOString();

describe("formatLastUsed", () => {
  it.each([
    [0, "1 phút trước"],
    [59, "59 phút trước"],
    [60, "1 giờ trước"],
    [120, "2 giờ trước"],
    [23 * 60 + 59, "23 giờ trước"],
    [24 * 60, "1 ngày trước"],
    [3 * 24 * 60, "3 ngày trước"],
    [7 * 24 * 60, "1 tuần trước"],
    [15 * 24 * 60, "2 tuần trước"],
  ])("%i minutes → %s", (min, text) => {
    expect(formatLastUsed(ago(min), NOW)).toBe(text);
  });
});

describe("formatEndedOn / targetName", () => {
  it("formats the end date", () => {
    expect(formatEndedOn("2026-08-17")).toBe("Kết thúc 17/08");
  });
  it("names targets", () => {
    expect(targetName({ kind: "personal" })).toBe("Cá nhân");
    expect(targetName({ kind: "group", groupId: "g", name: "Đà Lạt", icon: "", ended: false })).toBe("Đà Lạt");
  });
});
