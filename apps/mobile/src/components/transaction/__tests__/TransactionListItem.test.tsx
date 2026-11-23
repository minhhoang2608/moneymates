import { render, screen } from "@testing-library/react-native";

import type { TransactionRow } from "@/db/repositories";

import { TransactionListItem } from "../TransactionListItem";

const row = (over: Partial<TransactionRow>) =>
  ({ id: "1", type: "expense", amount: 50000, note: "phở", ...over }) as TransactionRow;

describe("TransactionListItem", () => {
  it("shows an expense as −50.000đ", async () => {
    await render(<TransactionListItem txn={row({})} categoryName="Ăn uống" />);
    expect(screen.getByText("−50.000đ")).toBeTruthy();
    expect(screen.getByText("phở")).toBeTruthy();
  });
  it("shows income as +25.000.000đ", async () => {
    await render(
      <TransactionListItem txn={row({ type: "income", amount: 25000000, note: "" })} categoryName="Lương" />,
    );
    expect(screen.getByText("+25.000.000đ")).toBeTruthy();
  });
});
