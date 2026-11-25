import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { StyleSheet } from "react-native";

import { Toast } from "@/components/Toast";
import { RepositoriesProvider } from "@/db/RepositoriesProvider";
import { createCategoryRepository, createHandOffRepository, createTransactionRepository } from "@/db/repositories";
import type { AnyDb } from "@/db/seed";
import { openTestDb } from "@/db/testing/testDb";
import { generateVietQr } from "@/lib/vietqr";
import { useReceiptSheet } from "@/stores/receiptSheet";
import { useToast } from "@/stores/toast";

import { emitE2eSharedImage } from "@/e2e/incomingShare";
import { ReceiptShareHandler } from "../ReceiptShareHandler";

jest.mock("@/e2e/incomingShare", () => ({ emitE2eSharedImage: jest.fn() }));
jest.mock("@/db/client", () => ({ db: {} }));

const mockPush = jest.fn();
jest.mock("expo-router", () => ({ useRouter: () => ({ push: mockPush, back: jest.fn() }) }));

let emit: (uri: string) => void = () => undefined;
jest.mock("@/lib/receipt/incomingShare", () => ({
  subscribeIncomingImage: (cb: (uri: string) => void) => {
    emit = cb;
    return () => undefined;
  },
}));

const URI = "file:///receipt.jpg";
const LINES = ["55.000 VND", "QUAN PHO HOA", "TPBank - 0123456789", "PHO HOA BAN 12"];
const now = Date.now();

async function setup(opts: { pending: boolean; lines: string[] }) {
  const db = openTestDb(path.join(fs.mkdtempSync(path.join(os.tmpdir(), "mm-rs-")), "t.db")).db as unknown as AnyDb;
  const handOffs = createHandOffRepository(db);
  const transactions = createTransactionRepository(db);
  const cat = (await createCategoryRepository(db).listByKind("expense"))[0];
  let txId: string | null = null;
  let hoId: string | null = null;
  if (opts.pending) {
    const qr = generateVietQr({ bankBin: "970423", account: "0123456789", name: "QUAN PHO HOA", amount: 55000 });
    const tx = await transactions.create({
      type: "expense",
      amount: 55000,
      category_id: cat.id,
      note: "x",
      occurred_at: new Date(now).toISOString(),
      source: "qr",
      qr_data: qr,
    });
    txId = tx.id;
    hoId = (
      await handOffs.create({
        transaction_id: tx.id,
        app_id: "tpb",
        method: "autofill",
        started_at: new Date(now - 5 * 60_000),
      })
    ).id;
  }
  const deleteQrImages = jest.fn().mockResolvedValue({ deleted: [] });
  const recognize = jest.fn().mockResolvedValue(opts.lines);
  const deps = { recognize, deleteQrImages };
  await render(
    <RepositoriesProvider db={db}>
      <ReceiptShareHandler deps={deps} />
      <Toast />
    </RepositoriesProvider>,
  );
  return { db, handOffs, transactions, txId, hoId, deleteQrImages, recognize };
}

const share = async () => act(async () => emit(URI));

describe("ReceiptShareHandler", () => {
  let fetchSpy: jest.SpyInstance;
  beforeEach(() => {
    mockPush.mockReset();
    fetchSpy = jest.fn() as never;
    global.fetch = fetchSpy as never;
    useReceiptSheet.setState({ current: null });
    useToast.setState({ text: null, action: null });
  });

  it("AC1/AC2: a matching pending payment gets the receipt, toast with undo, QR image deleted", async () => {
    const { handOffs, hoId, deleteQrImages } = await setup({ pending: true, lines: LINES });
    await share();
    expect(await screen.findByText("Đã đính kèm biên lai · QUAN PHO HOA đã trả")).toBeTruthy();
    expect(deleteQrImages).toHaveBeenCalledWith([hoId]);
    expect((await handOffs.get(hoId!))?.receipt_uri).toBe(URI);
    expect(screen.queryByTestId("receipt-sheet")).toBeNull();

    await act(async () => fireEvent.press(screen.getByTestId("app-toast-action")));
    await waitFor(async () => expect((await handOffs.get(hoId!))?.receipt_uri).toBeNull());
    expect((await handOffs.get(hoId!))?.paid_signal).toBeNull();
    expect(screen.queryByTestId("app-toast")).toBeNull();
  });

  it("AC3/AC4/AC6: no match opens the sheet; Ghi giao dịch saves a receipt expense, no fetch, no navigation", async () => {
    const { transactions } = await setup({ pending: false, lines: LINES });
    await share();
    expect(await screen.findByText("Biên lai chuyển khoản")).toBeTruthy();
    expect(screen.getByTestId("receipt-sheet-from")).toHaveTextContent("Từ TPBank · đọc trên máy");
    expect(screen.getByTestId("receipt-amount")).toHaveTextContent("55.000đ");
    expect(screen.getByTestId("receipt-recipient")).toHaveTextContent("QUAN PHO HOA");
    expect(screen.getByTestId("receipt-account")).toHaveTextContent("TPBank · 0123 4567 89");
    expect(screen.getByTestId("receipt-message")).toHaveTextContent("PHO HOA BAN 12");
    await waitFor(() => expect(screen.getByTestId("receipt-no-match")).toHaveTextContent(/Ăn uống\.$/));
    expect(
      screen.getByText("Không khớp giao dịch nào đang chờ. Ghi thành giao dịch mới, danh mục tự chọn: ", {
        exact: false,
      }),
    ).toBeTruthy();

    await act(async () => fireEvent.press(screen.getByTestId("receipt-save")));
    const rows = await transactions.list();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ amount: 55000, source: "receipt", attachment_uri: URI, type: "expense" });
    expect(useReceiptSheet.getState().current).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("AC4: Sửa opens the form prefilled, Bỏ qua saves nothing", async () => {
    const { transactions } = await setup({ pending: false, lines: LINES });
    await share();
    await act(async () => fireEvent.press(await screen.findByTestId("receipt-edit")));
    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(mockPush.mock.calls[0][0]).toMatchObject({
      pathname: "/transaction/new",
      params: { source: "receipt", amount: "55000", attachmentUri: URI },
    });
    expect(useReceiptSheet.getState().current).toBeNull();

    await share();
    await act(async () => fireEvent.press(await screen.findByTestId("receipt-skip")));
    expect(useReceiptSheet.getState().current).toBeNull();
    expect(await transactions.list()).toHaveLength(0);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("AC5: unreadable image gives editable empty fields and still attaches the image", async () => {
    const { transactions } = await setup({ pending: false, lines: [] });
    await share();
    const amount = await screen.findByTestId("receipt-amount-input");
    expect(amount.props.value).toBe("");
    expect(screen.getByTestId("receipt-recipient-input")).toBeTruthy();
    await act(async () => fireEvent.changeText(amount, "55000"));
    await act(async () => fireEvent.press(screen.getByTestId("receipt-save")));
    const rows = await transactions.list();
    expect(rows[0]).toMatchObject({ amount: 55000, source: "receipt", attachment_uri: URI });
  });

  it("empty amount cannot be saved", async () => {
    const { transactions } = await setup({ pending: false, lines: [] });
    await share();
    await act(async () => fireEvent.press(await screen.findByTestId("receipt-save")));
    expect(await screen.findByTestId("receipt-error")).toBeTruthy();
    expect(await transactions.list()).toHaveLength(0);
  });

  describe("E2E share trigger", () => {
    afterEach(() => {
      delete process.env.EXPO_PUBLIC_E2E;
    });

    it("AC1: in E2E mode it is a 1x1 box at the right-middle edge, not top-left, and still emits", async () => {
      process.env.EXPO_PUBLIC_E2E = "1";
      await setup({ pending: false, lines: LINES });
      const trigger = screen.getByTestId("e2e-share-receipt");
      const style = StyleSheet.flatten(trigger.props.style);
      expect(style).toMatchObject({ position: "absolute", right: 0, top: "50%", width: 1, height: 1 });
      expect(style.left).toBeUndefined();
      await act(async () => fireEvent.press(trigger));
      expect(emitE2eSharedImage).toHaveBeenCalled();
    });

    it("is not rendered outside E2E mode", async () => {
      await setup({ pending: false, lines: LINES });
      expect(screen.queryByTestId("e2e-share-receipt")).toBeNull();
    });
  });
});
