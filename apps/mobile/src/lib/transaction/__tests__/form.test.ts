import { formatTxnDateLabel, signedAmountLabel, validateForm, type FormState } from "../form";

const base: FormState = {
  type: "expense",
  amountText: "50k",
  categoryId: "cat-1",
  note: "  phở ",
  occurredAt: new Date("2026-11-23T05:00:00.000Z"),
  moneySource: "Tiền mặt",
  photoUri: null,
};

describe("validateForm", () => {
  it("builds the repository input with integer VND and ISO UTC time", () => {
    const r = validateForm(base);
    expect(r).toEqual({
      ok: true,
      input: {
        type: "expense",
        amount: 50000,
        category_id: "cat-1",
        note: "phở",
        occurred_at: "2026-11-23T05:00:00.000Z",
        money_source: "Tiền mặt",
        photo_uri: null,
      },
    });
  });

  it.each(["", "0", "abc"])("rejects amount %p", (amountText) => {
    expect(validateForm({ ...base, amountText })).toEqual({ ok: false, errors: { amount: true } });
  });

  it("requires a category", () => {
    expect(validateForm({ ...base, categoryId: null })).toEqual({ ok: false, errors: { category: true } });
  });
});

describe("signedAmountLabel", () => {
  it("uses U+2212 for expenses and + for income", () => {
    expect(signedAmountLabel("expense", 50000)).toBe("−50.000đ");
    expect(signedAmountLabel("income", 25000000)).toBe("+25.000.000đ");
  });
});

describe("formatTxnDateLabel", () => {
  const now = new Date(2026, 10, 23, 14, 20);
  it("labels today, yesterday and older dates in local time", () => {
    expect(formatTxnDateLabel(new Date(2026, 10, 23, 9, 5), now)).toBe("Hôm nay, 09:05");
    expect(formatTxnDateLabel(new Date(2026, 10, 22, 19, 30), now)).toBe("Hôm qua, 19:30");
    expect(formatTxnDateLabel(new Date(2026, 9, 3, 8, 0), now)).toBe("03/10/2026, 08:00");
  });
});
