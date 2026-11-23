import { topCategories } from "../topCategories";

const e = (category: string | null, amount: number) => ({ type: "expense" as const, category, amount });

describe("topCategories", () => {
  const txns = [
    e("Mua sắm", 100_000),
    e("Ăn uống", 100_000),
    e("Di chuyển", 200_000),
    e("Ăn uống", 200_000),
    { type: "income" as const, category: "Lương", amount: 9_000_000 },
  ];

  test("sums, sorts desc, ignores income", () => {
    expect(topCategories(txns, 10)).toEqual([
      { category: "Ăn uống", amount: 300_000 },
      { category: "Di chuyển", amount: 200_000 },
      { category: "Mua sắm", amount: 100_000 },
    ]);
  });

  test("n truncates", () => expect(topCategories(txns, 1)).toHaveLength(1));

  test("ties are deterministic", () => {
    const a = topCategories([e("B", 5), e("A", 5)], 2);
    const b = topCategories([e("A", 5), e("B", 5)], 2);
    expect(a).toEqual(b);
    expect(a[0].category).toBe("A");
  });

  test("missing category -> Khác", () => {
    expect(topCategories([e(null, 7)], 3)).toEqual([{ category: "Khác", amount: 7 }]);
  });
});
