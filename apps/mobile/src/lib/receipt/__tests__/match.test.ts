import { matchReceipt, type PendingHandOff } from "../match";
import type { ParsedReceipt } from "../rules";

const now = new Date("2026-01-01T10:00:00.000Z");
const ago = (min: number) => new Date(now.getTime() - min * 60_000).toISOString();
const receipt = (p: Partial<ParsedReceipt> = {}): ParsedReceipt => ({
  amount: 55000,
  recipient: null,
  bankName: null,
  accountNumber: "0123 456 789",
  message: null,
  paidAt: null,
  transactionId: null,
  ...p,
});
const pend = (p: Partial<PendingHandOff> = {}): PendingHandOff => ({
  handOffId: "h1",
  startedAt: ago(5),
  amount: 55000,
  accountNumber: "0123456789",
  recipientName: "Quán Phở Hòa",
  paidSignal: null,
  ...p,
});

describe("matchReceipt", () => {
  it("matches on amount and account", () => {
    expect(matchReceipt(receipt(), [pend()], now)?.handOffId).toBe("h1");
  });
  it("matches on name alone, ignoring case and diacritics", () => {
    const r = receipt({ accountNumber: null, recipient: "QUAN  PHO HOA " });
    expect(matchReceipt(r, [pend({ accountNumber: null })], now)?.handOffId).toBe("h1");
  });
  it("rejects old, different amount, or already receipt-paid", () => {
    expect(matchReceipt(receipt(), [pend({ startedAt: ago(45) })], now)).toBeNull();
    expect(matchReceipt(receipt(), [pend({ amount: 50000 })], now)).toBeNull();
    expect(matchReceipt(receipt(), [pend({ paidSignal: "receipt" })], now)).toBeNull();
  });
  it("picks the closest in time", () => {
    const hit = matchReceipt(
      receipt(),
      [pend({ handOffId: "a", startedAt: ago(20) }), pend({ handOffId: "b", startedAt: ago(2) })],
      now,
    );
    expect(hit?.handOffId).toBe("b");
  });
  it("handles the window edges", () => {
    expect(matchReceipt(receipt(), [pend({ startedAt: ago(30) })], now)).not.toBeNull();
    expect(matchReceipt(receipt(), [pend({ startedAt: ago(31) })], now)).toBeNull();
    expect(matchReceipt(receipt(), [pend({ startedAt: ago(-1) })], now)).toBeNull();
  });
  it("returns null without an amount", () => {
    expect(matchReceipt(receipt({ amount: null }), [pend()], now)).toBeNull();
  });
});
