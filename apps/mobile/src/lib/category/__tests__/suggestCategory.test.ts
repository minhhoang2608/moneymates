import { DEFAULT_CATEGORIES } from "../defaults";
import { CATEGORY_KEYWORDS } from "../keywords";
import { suggestCategory } from "../suggestCategory";

const fetchMock = jest.fn();
(global as unknown as { fetch: unknown }).fetch = fetchMock;

const name = (m: string | null, r: string | null = null) => suggestCategory(r, m)?.name ?? null;

afterAll(() => expect(fetchMock).not.toHaveBeenCalled());

describe("suggestCategory", () => {
  it("matches food", () => {
    const c = suggestCategory(null, "PHO 24");
    expect(c?.name).toBe("Ăn uống");
    expect(c?.id).toBe("813c5c60-cf5a-43a4-9b5b-dbc4f473f2fb");
    expect(name("CAFE SANG")).toBe("Ăn uống");
    expect(name("", "QUAN PHO 24")).toBe("Ăn uống");
  });
  it("matches transport", () => expect(name("GRAB 123456")).toBe("Di chuyển"));
  it("returns null without a match", () => {
    expect(name("CHUYEN TIEN THANG 11")).toBeNull();
    expect(name("")).toBeNull();
    expect(suggestCategory(null, undefined)).toBeNull();
    expect(name("BEN THANH")).toBeNull();
    expect(name("PHOTO")).toBeNull();
  });
  it("ignores case and diacritics", () => {
    expect(name("Phở 24")).toBe("Ăn uống");
    expect(name("phở")).toBe("Ăn uống");
    expect(name("Cà phê sáng")).toBe("Ăn uống");
    expect(name("GrAb")).toBe("Di chuyển");
    expect(name("Tiền điện tháng 3")).toBe("Hóa đơn");
  });
  it("breaks ties by earliest position, message before recipient", () => {
    expect(name("GRAB DI AN PHO")).toBe("Di chuyển");
    expect(suggestCategory("QUAN PHO", "GRAB")?.name).toBe("Di chuyển");
  });
  it("does not match across fields", () => {
    expect(suggestCategory("CA", "PHE")).toBeNull();
  });
});

describe("CATEGORY_KEYWORDS", () => {
  const norm = (s: string) => s.trim();
  it("uses existing expense categories except Khác", () => {
    for (const { category } of CATEGORY_KEYWORDS) {
      expect(category).not.toBe("Khác");
      expect(DEFAULT_CATEGORIES.some((c) => c.type === "expense" && c.name === category)).toBe(true);
    }
  });
  it("has no empty or duplicate keywords and a sane size", () => {
    const all = CATEGORY_KEYWORDS.flatMap((c) => c.keywords.map(norm));
    expect(all.every((k) => k.length > 0)).toBe(true);
    expect(new Set(all).size).toBe(all.length);
    expect(all.length).toBeGreaterThanOrEqual(40);
    expect(all.length).toBeLessThanOrEqual(80);
  });
});
