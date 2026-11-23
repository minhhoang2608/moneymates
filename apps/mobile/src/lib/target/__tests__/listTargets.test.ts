import { listTargets } from "../listTargets";
import { NOW, grp, hoursAgo } from "../testFixtures";

const dalat = grp("dl", "Đà Lạt 12/2026");
const lunch = grp("an", "Ăn trưa văn phòng");
const phuQuoc = grp("pq", "Phú Quốc 08/2026", { end_date: "2026-08-17" });
const used = new Map([
  ["dl", hoursAgo(2)],
  ["an", hoursAgo(72)],
  ["pq", "2026-08-10T00:00:00Z"],
]);
const names = (t: ReturnType<typeof listTargets>) => t.map((x) => (x.kind === "personal" ? "personal" : x.groupId));

describe("listTargets", () => {
  it("orders Cá nhân, recent groups, then ended groups", () => {
    const r = listTargets({ groups: [phuQuoc, lunch, dalat], lastUsedByGroup: used, now: NOW });
    expect(names(r)).toEqual(["personal", "dl", "an", "pq"]);
    expect(r[3]).toMatchObject({ ended: true });
    expect(r[1]).toMatchObject({ ended: false });
  });

  it("puts never-used active groups after used ones, newest created first", () => {
    const n1 = grp("n1", "Mới 1", { created_at: "2026-11-01T00:00:00Z" });
    const n2 = grp("n2", "Mới 2", { created_at: "2026-12-01T00:00:00Z" });
    const r = listTargets({ groups: [n1, n2, lunch], lastUsedByGroup: used, now: NOW });
    expect(names(r)).toEqual(["personal", "an", "n2", "n1"]);
  });

  it("treats a group ending today as active", () => {
    const today = grp("t", "Hôm nay", { end_date: "2026-12-10" });
    expect(listTargets({ groups: [today], lastUsedByGroup: new Map(), now: NOW })[1]).toMatchObject({ ended: false });
  });

  it("orders ended groups by last use, then end date", () => {
    const a = grp("a", "A", { end_date: "2026-01-01" });
    const b = grp("b", "B", { end_date: "2026-02-01" });
    const c = grp("c", "C", { end_date: "2026-03-01" });
    const r = listTargets({ groups: [a, b, c], lastUsedByGroup: new Map([["a", "2026-01-01T00:00:00Z"]]), now: NOW });
    expect(names(r)).toEqual(["personal", "a", "c", "b"]);
  });

  it.each([["phú"], ["PHU"], ["phu quoc"]])("query %s returns only Phú Quốc", (q) => {
    const r = listTargets({ groups: [phuQuoc, lunch, dalat], lastUsedByGroup: used, now: NOW, query: q });
    expect(names(r)).toEqual(["pq"]);
  });

  it("matches Cá nhân and đ/d", () => {
    const all = { groups: [phuQuoc, lunch, dalat], lastUsedByGroup: used, now: NOW };
    expect(names(listTargets({ ...all, query: "ca nhan" }))).toEqual(["personal"]);
    expect(names(listTargets({ ...all, query: "đà" }))).toEqual(["dl"]);
    expect(names(listTargets({ ...all, query: "da lat" }))).toEqual(["dl"]);
  });

  it("returns the full list for an empty or blank query", () => {
    const all = { groups: [phuQuoc, lunch, dalat], lastUsedByGroup: used, now: NOW };
    expect(listTargets({ ...all, query: "   " })).toHaveLength(4);
    expect(listTargets(all)).toHaveLength(4);
  });
});
