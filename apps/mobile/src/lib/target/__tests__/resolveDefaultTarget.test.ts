import { isGroupEnded, vnToday } from "../clock";
import { resolveDefaultTarget } from "../resolveDefaultTarget";
import type { LastUsed } from "../types";
import { NOW, grp, hoursAgo } from "../testFixtures";

const dalat = grp("dl", "Đà Lạt");
const used = (h: number | string, id = "dl"): LastUsed => ({
  target: { groupId: id },
  at: typeof h === "number" ? hoursAgo(h) : h,
});
const resolve = (lastUsed: LastUsed, groups = [dalat], fromGroupId?: string) =>
  resolveDefaultTarget({ lastUsed, groups, now: NOW, fromGroupId });
const personal = { kind: "personal" };

describe("resolveDefaultTarget", () => {
  it("uses the last-used group within 24h", () => {
    expect(resolve(used(2))).toMatchObject({ kind: "group", groupId: "dl", ended: false });
  });
  it("falls back to Cá nhân after 25h", () => expect(resolve(used(25))).toEqual(personal));
  it("falls back when the group ended yesterday (VN)", () => {
    expect(resolve(used(2), [grp("dl", "x", { end_date: "2026-12-09" })])).toEqual(personal);
  });
  it("keeps a group ending today", () => {
    expect(resolve(used(2), [grp("dl", "x", { end_date: "2026-12-10" })])).toMatchObject({ kind: "group" });
  });
  it("handles null, personal, unknown group and bad dates", () => {
    expect(resolve(null)).toEqual(personal);
    expect(resolve({ target: "personal", at: hoursAgo(1) })).toEqual(personal);
    expect(resolve(used(1, "gone"))).toEqual(personal);
    expect(resolve(used("not a date"))).toEqual(personal);
  });
  it("accepts exactly 24h but not 24h + 1ms", () => {
    expect(resolve(used(24))).toMatchObject({ kind: "group" });
    expect(resolve(used(new Date(NOW.getTime() - 24 * 3600_000 - 1).toISOString()))).toEqual(personal);
  });
  it("fromGroupId wins over a fresh last-used group, and when last use is missing or stale", () => {
    const other = grp("o", "Other");
    const groups = [dalat, other];
    expect(resolve(used(1), groups, "o")).toMatchObject({ groupId: "o" });
    expect(resolve(null, groups, "o")).toMatchObject({ groupId: "o" });
    expect(resolve(used(100, "o"), groups, "o")).toMatchObject({ groupId: "o" });
  });
  it("fromGroupId wins even for an ended group; unknown id falls back", () => {
    const ended = grp("e", "Ended", { end_date: "2026-01-01" });
    expect(resolve(null, [ended], "e")).toMatchObject({ groupId: "e", ended: true });
    expect(resolve(null, [dalat], "missing")).toEqual(personal);
  });
});

describe("vnToday / isGroupEnded", () => {
  it("rolls to the next day at 17:00 UTC", () => {
    expect(vnToday(new Date("2026-12-09T17:30:00Z"))).toBe("2026-12-10");
    expect(vnToday(new Date("2026-12-09T16:59:00Z"))).toBe("2026-12-09");
    expect(isGroupEnded({ end_date: "2026-12-09" }, new Date("2026-12-09T17:30:00Z"))).toBe(true);
    expect(isGroupEnded({ end_date: null }, NOW)).toBe(false);
  });
});
