import { expenseLine } from "../expenseLine";

describe("expenseLine", () => {
  it("me as payer, equal", () => {
    expect(expenseLine({ payerName: "Hoàng", payerIsMe: true, splitMode: "equal", shareCount: 4 })).toBe(
      "Tôi trả · chia đều 4",
    );
  });
  it("member as payer, amount", () => {
    expect(expenseLine({ payerName: "An", payerIsMe: false, splitMode: "amount", shareCount: 3 })).toBe(
      "An trả · theo số tiền 3",
    );
  });
  it("percent", () => {
    expect(expenseLine({ payerName: "An", payerIsMe: false, splitMode: "percent", shareCount: 2 })).toBe(
      "An trả · theo tỷ lệ 2",
    );
  });
});
