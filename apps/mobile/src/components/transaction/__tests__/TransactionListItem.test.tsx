import { StyleSheet } from "react-native";
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
  it("defaults to a bottom divider; divider=top uses a top border", async () => {
    await render(<TransactionListItem txn={row({})} categoryName="Ăn uống" />);
    const def = StyleSheet.flatten(screen.getByTestId("txn-item-1").props.style);
    expect(def.borderBottomWidth).toBe(1);
    expect(def.borderTopWidth).toBeUndefined();
    await render(<TransactionListItem txn={row({ id: "2" })} categoryName="Ăn uống" divider="top" />);
    const top = StyleSheet.flatten(screen.getByTestId("txn-item-2").props.style);
    expect(top).toMatchObject({ borderTopWidth: 1, borderTopColor: "#EEF0F3" });
    expect(top.borderBottomWidth).toBeUndefined();
  });
});
