import { buildQrExpense, buildQrGroupExpense, canSubmit } from "../form";
import type { PayConfirmModel } from "../params";

const model: PayConfirmModel = {
  kind: "vietqr",
  bankName: "TPBank",
  bankBin: "970423",
  account: "0123456789",
  isDynamic: true,
  payload: "000201...",
};

describe("canSubmit", () => {
  it.each(["", "0", "abc", "-5"])("rejects %j", (t) => expect(canSubmit(t)).toBe(false));
  it.each(["55.000", "55k", "55000"])("accepts %j", (t) => expect(canSubmit(t)).toBe(true));
});

describe("buildQrExpense", () => {
  it("builds a qr expense carrying the payload", () => {
    const now = new Date("2026-01-02T03:04:05Z");
    expect(buildQrExpense(model, { amount: 55000, categoryId: "c1", note: " PHO " }, now)).toEqual({
      type: "expense",
      amount: 55000,
      category_id: "c1",
      note: "PHO",
      occurred_at: "2026-01-02T03:04:05.000Z",
      source: "qr",
      qr_data: "000201...",
    });
  });
});

describe("buildQrGroupExpense", () => {
  it("makes Tôi the payer and splits equally across all members", () => {
    const now = new Date("2026-01-02T03:04:05Z");
    const members = [
      { id: "m1", isMe: true },
      { id: "m2", isMe: false },
      { id: "m3", isMe: false },
    ];
    expect(buildQrGroupExpense(model, { amount: 300000, categoryId: "c1", note: " PHO " }, "g1", members, now)).toEqual(
      {
        groupId: "g1",
        amount: 300000,
        payerMemberId: "m1",
        splitMode: "equal",
        shares: [{ memberId: "m1" }, { memberId: "m2" }, { memberId: "m3" }],
        occurredAt: "2026-01-02T03:04:05.000Z",
        categoryId: "c1",
        note: "PHO",
        source: "qr",
        qrData: "000201...",
      },
    );
  });
});
