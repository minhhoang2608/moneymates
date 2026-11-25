import { render } from "@testing-library/react-native";

import NewTransactionScreen from "../transaction/new";

const mockForm = jest.fn((_props: unknown) => null);
jest.mock("@/components/transaction/TransactionForm", () => ({
  TransactionForm: (p: unknown) => mockForm(p),
}));
jest.mock("expo-router", () => ({
  useRouter: () => ({ back: jest.fn() }),
  useLocalSearchParams: () => ({
    source: "receipt",
    amount: "55000",
    note: "PHO HOA BAN 12",
    categoryId: "cat-1",
    date: "2026-03-05T11:30:12.000Z",
    attachmentUri: "file:///receipt.jpg",
  }),
}));

describe("transaction/new with source=receipt", () => {
  it("prefills the form and keeps the receipt image", async () => {
    await render(<NewTransactionScreen />);
    const props = mockForm.mock.calls[0][0] as {
      source: string;
      initial: { amountVnd: number; note: string; categoryId: string; photoUri: string; occurredAt: Date };
    };
    expect(props.source).toBe("receipt");
    expect(props.initial).toMatchObject({
      amountVnd: 55000,
      note: "PHO HOA BAN 12",
      categoryId: "cat-1",
      photoUri: "file:///receipt.jpg",
    });
    expect(props.initial.occurredAt.toISOString()).toBe("2026-03-05T11:30:12.000Z");
  });
});
