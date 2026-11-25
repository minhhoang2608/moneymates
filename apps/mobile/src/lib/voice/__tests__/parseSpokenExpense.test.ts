import { DEFAULT_CATEGORIES } from "../../category";
import { parseSpokenExpense } from "../parseSpokenExpense";

const categories = DEFAULT_CATEGORIES.map((c) => ({ id: c.id, name: c.name, type: c.type }));
const members = [
  { id: "m-me", name: "Tôi", isMe: true },
  { id: "m-an", name: "An", isMe: false },
  { id: "m-binh", name: "Bình", isMe: false },
];

describe("parseSpokenExpense", () => {
  let fetchMock: jest.Mock;
  const realFetch = global.fetch;
  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });
  afterEach(() => {
    expect(fetchMock).not.toHaveBeenCalled();
    global.fetch = realFetch;
  });

  it("parses a simple sentence offline", () => {
    const r = parseSpokenExpense("ăn phở 50 nghìn", { categories });
    expect(r).toMatchObject({
      amount: 50_000,
      currency: "VND",
      note: "phở",
      category: { name: "Ăn uống" },
      payer: { memberId: null, name: "Tôi", matched: false },
      needsAi: false,
    });
  });

  it("finds the payer and spoken amount words", () => {
    const r = parseSpokenExpense("Bình trả tiền xăng hai trăm nghìn", { categories, members });
    expect(r).toMatchObject({
      amount: 200_000,
      note: "Tiền xăng",
      category: { name: "Di chuyển" },
      payer: { memberId: "m-binh", name: "Bình", matched: true },
      needsAi: false,
    });
  });

  it("matches the payer without accents", () => {
    const r = parseSpokenExpense("binh tra tien xang 200k", { categories, members });
    expect(r.amount).toBe(200_000);
    expect(r.payer).toEqual({ memberId: "m-binh", name: "Bình", matched: true });
  });

  it("falls back to me for an unknown payer or no members", () => {
    const r = parseSpokenExpense("Nam trả tiền xăng 200k", { categories, members });
    expect(r.payer).toEqual({ memberId: "m-me", name: "Tôi", matched: false });
    expect(r.amount).toBe(200_000);
    const r2 = parseSpokenExpense("Nam trả tiền xăng 200k", { categories });
    expect(r2.payer.name).toBe("Tôi");
  });

  it.each([["đi chơi vui quá"], ["hai trăm"], ["50 nghìn với 30 nghìn"], ["mua quà 100 nghìn"]])(
    "asks for AI on %j",
    (s) => {
      expect(parseSpokenExpense(s, { categories, members }).needsAi).toBe(true);
    },
  );

  it("asks for AI when two members share a name", () => {
    const dup = [...members, { id: "m-binh2", name: "binh", isMe: false }];
    expect(parseSpokenExpense("Bình trả tiền xăng 200k", { categories, members: dup }).needsAi).toBe(true);
  });

  it("keeps the amount when the category is unknown", () => {
    const r = parseSpokenExpense("mua quà 100 nghìn", { categories });
    expect(r).toMatchObject({ amount: 100_000, note: "quà", category: null });
  });

  it("parses 1tr2 as an integer", () => {
    const r = parseSpokenExpense("cà phê 1tr2", { categories });
    expect(r.amount).toBe(1_200_000);
    expect(Number.isInteger(r.amount)).toBe(true);
    expect(r.category?.name).toBe("Ăn uống");
  });

  it("does not read a headcount as money", () => {
    expect(parseSpokenExpense("ăn phở 2 người 100k", { categories }).amount).toBe(100_000);
  });

  describe("payer with a leading filler word", () => {
    const group = [
      { id: "m-me", name: "Tôi", isMe: true },
      { id: "m-an", name: "An", isMe: false },
      { id: "m-minh", name: "Minh", isMe: false },
    ];
    it.each([["An Minh tra 300k an toi"], ["Anh Minh trả 300k ăn tối"]])("%s -> Minh pays", (text) => {
      const r = parseSpokenExpense(text, { categories, members: group });
      expect(r.amount).toBe(300_000);
      expect(r.payer).toMatchObject({ memberId: "m-minh", matched: true });
      expect(r.note).not.toBe("");
      expect(r.note.toLowerCase()).not.toContain("minh");
    });
    it("still matches a plain name and falls back to me for an unknown one", () => {
      expect(parseSpokenExpense("An trả 300k ăn tối", { categories, members: group }).payer.memberId).toBe("m-an");
      expect(parseSpokenExpense("Nam trả 300k ăn tối", { categories, members: group }).payer.memberId).toBe("m-me");
    });
    it("is ambiguous when two members end with the same word", () => {
      const two = [
        { id: "m-me", name: "Tôi", isMe: true },
        { id: "m-a", name: "Lan Minh", isMe: false },
        { id: "m-b", name: "Hoàng Minh", isMe: false },
      ];
      const r = parseSpokenExpense("Anh Minh trả 300k ăn tối", { categories, members: two });
      expect(r.payer).toMatchObject({ memberId: "m-me", matched: false });
      expect(r.needsAi).toBe(true);
    });
  });
});
