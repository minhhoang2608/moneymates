import { formatBillDate, toBillCard, toFormParams } from "../billResult";
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
      attachmentUri: "file:///b.jpg",
    });
    expect(toFormParams(null, null, null)).toEqual({ source: "bill" });
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
