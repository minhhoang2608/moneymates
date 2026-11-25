import { render, screen } from "@testing-library/react-native";

import type { TransactionRow } from "@/db/repositories";

import { HistoryRow } from "../HistoryRow";

const txn = {
  id: "t1",
  type: "expense",
  amount: 55000,
  note: "PHO",
  source: "qr",
  money_source: "Tiền mặt",
  occurred_at: "2026-01-01T10:00:00.000Z",
} as unknown as TransactionRow;

describe("HistoryRow receipt flag", () => {
  it("shows 'có biên lai' when the transaction has a receipt", async () => {
    await render(<HistoryRow txn={txn} categoryName="Ăn uống" hasReceipt />);
    expect(screen.getByText("có biên lai")).toBeTruthy();
  });

  it("hides it otherwise", async () => {
    await render(<HistoryRow txn={txn} categoryName="Ăn uống" />);
    expect(screen.queryByText("có biên lai")).toBeNull();
  });
});
