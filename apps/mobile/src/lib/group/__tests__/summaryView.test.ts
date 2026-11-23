import { formatSigned, toSummaryView } from "../summaryView";

const members = [
  { id: "me", displayName: "Hoàng", isMe: true },
  { id: "an", displayName: "An", isMe: false },
  { id: "binh", displayName: "Bình", isMe: false },
];

describe("formatSigned", () => {
  it("signs amounts", () => {
    expect(formatSigned(500000)).toBe("+500.000đ");
    expect(formatSigned(-400000)).toBe("−400.000đ");
    expect(formatSigned(0)).toBe("0đ");
  });
});

describe("toSummaryView", () => {
  it("builds rows, items and the to-collect total", () => {
    const v = toSummaryView(
      members,
      {
        rows: [
          { memberId: "me", isMe: true, paid: 900000, owed: 400000, balance: 500000 },
          { memberId: "an", isMe: false, paid: 0, owed: 400000, balance: -400000 },
          { memberId: "binh", isMe: false, paid: 0, owed: 100000, balance: 100000 },
        ],
        items: [
          { from: "an", to: "me", amount: 400000 },
          { from: "me", to: "binh", amount: 100000 },
        ],
      },
      "Tôi",
    );
    expect(v.rows.map((r) => r.tone)).toEqual(["positive", "negative", "positive"]);
    expect(v.rows[0].name).toBe("Tôi");
    expect(v.items).toEqual([
      { memberId: "an", label: "An trả Tôi 400.000đ", amount: 400000, hasQr: true },
      { memberId: "binh", label: "Tôi trả Bình 100.000đ", amount: 100000, hasQr: false },
    ]);
    expect(v.toCollect).toBe(400000);
  });
});
