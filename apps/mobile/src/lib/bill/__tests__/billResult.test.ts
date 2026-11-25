import { billDateToLocal, formatBillDate, toBillCard, toFormParams } from "../billResult";
import { resizeTarget } from "../resizeTarget";

const full = { amount: 345000, currency: "VND", shop: "Bánh căn Nhà Chung", date: "2026-11-22", category: "Ăn uống" };

describe("billResult", () => {
  it("formats amount, shop, date and category", () => {
    expect(toBillCard(full)).toEqual({
      amount: "345.000đ",
      shop: "Bánh căn Nhà Chung",
      date: "22/11/2026",
      category: "Ăn uống",
    });
  });
  it("shows a dash for null fields", () => {
    expect(toBillCard({ amount: null, currency: "VND", shop: null, date: null, category: null })).toEqual({
      amount: "—",
      shop: "—",
      date: "—",
      category: "—",
    });
    expect(formatBillDate("garbage")).toBe("—");
  });
  it("builds the form params", () => {
    expect(toFormParams(full, "file:///b.jpg", "cat1")).toEqual({
      source: "bill",
      amount: "345000",
      note: "Bánh căn Nhà Chung",
      categoryId: "cat1",
      date: "2026-11-22",
      attachmentUri: "file:///b.jpg",
    });
    expect(toFormParams(null, null, null)).toEqual({ source: "bill" });
    expect(toFormParams(full, null, "cat1", "g1")).toEqual({
      source: "bill",
      groupId: "g1",
      amount: "345000",
      note: "Bánh căn Nhà Chung",
      categoryId: "cat1",
      date: "2026-11-22",
    });
    expect(toFormParams(full, null, "cat1")).not.toHaveProperty("groupId");
    expect(toFormParams(null, null, "cat1", "g1")).toEqual({ source: "bill", groupId: "g1", categoryId: "cat1" });
    expect(toFormParams({ ...full, date: "garbage" }, null, null)).not.toHaveProperty("date");
  });
  it("maps the bill date to that local day with the current time of day", () => {
    const now = new Date(2026, 10, 25, 14, 30, 5);
    expect(billDateToLocal("2026-11-22", now)).toEqual(new Date(2026, 10, 22, 14, 30, 5));
    expect(billDateToLocal(null, now)).toBe(now);
    expect(billDateToLocal("garbage", now)).toBe(now);
    expect(billDateToLocal("2026-02-31", now)).toBe(now);
  });
});

describe("resizeTarget", () => {
  it("shrinks a landscape image by width", () => expect(resizeTarget(4000, 3000)).toEqual({ width: 1600 }));
  it("shrinks a portrait image by height", () => expect(resizeTarget(3000, 4000)).toEqual({ height: 1600 }));
  it("never enlarges", () => {
    expect(resizeTarget(800, 600)).toBeNull();
    expect(resizeTarget(1600, 1000)).toBeNull();
  });
});
