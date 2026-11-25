import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { AppState } from "react-native";

import { RepositoriesProvider } from "@/db/RepositoriesProvider";
import {
  createCategoryRepository,
  createGroupExpenseRepository,
  createHandOffRepository,
  createTransactionRepository,
} from "@/db/repositories";
import { monthKeyOf } from "@/lib/stats";
import { loadCategoryBreakdown } from "@/lib/stats/loadStats";
import type { AnyDb } from "@/db/seed";
import { openTestDb } from "@/db/testing/testDb";
import { usePendingHandOff } from "@/stores/pendingHandOff";

import { HIDE_AFTER_MS, ReturnBanner } from "../ReturnBanner";

jest.mock("@/db/client", () => ({ db: {} }));

let handler: (s: string) => void = () => {};
beforeEach(() => {
  jest.spyOn(AppState, "addEventListener").mockImplementation(((_t: string, h: (s: string) => void) => {
    handler = h;
    return { remove: jest.fn() };
  }) as never);
  usePendingHandOff.setState({ pending: null, visible: false, deletedVersion: 0 });
});
afterEach(() => jest.restoreAllMocks());

async function setup() {
  const db = openTestDb(path.join(fs.mkdtempSync(path.join(os.tmpdir(), "mm-rb-")), "t.db")).db as unknown as AnyDb;
  const cat = (await createCategoryRepository(db).listByKind("expense"))[0];
  const repo = createTransactionRepository(db);
  const tx = await repo.create({
    type: "expense",
    amount: 55000,
    category_id: cat.id,
    note: "PHO 24",
    occurred_at: new Date().toISOString(),
    source: "qr",
  });
  await render(
    <RepositoriesProvider db={db}>
      <ReturnBanner />
    </RepositoriesProvider>,
  );
  return { repo, tx, db };
}

const mockStart = jest.fn();
jest.mock("@/lib/payConfirm/startHandOff", () => ({ startHandOff: (...a: unknown[]) => mockStart(...a) }));
jest.mock("@/components/payConfirm/HandOffQr", () => ({ HandOffQr: () => null }));

const tpb = { id: "tpb", name: "TPBank" } as never;
const reopenOf = (qrInAlbum: boolean) => ({
  app: tpb,
  model: { kind: "other", payload: "x" } as never,
  amount: 55000,
  note: "PHO HOA BAN 12",
  qrInAlbum,
});
const ret = async () => {
  await act(async () => handler("background"));
  await act(async () => handler("active"));
};

describe("ReturnBanner", () => {
  beforeEach(() => mockStart.mockReset());

  it("return shows saved line and Hoàn tác, no question", async () => {
    const { tx } = await setup();
    await act(async () => usePendingHandOff.getState().set({ txId: tx.id, amount: 55000, label: "PHO HOA BAN 12" }));
    expect(screen.queryByTestId("handoff-return-banner")).toBeNull();
    await ret();
    expect(await screen.findByText("Đã lưu 55.000đ · PHO HOA BAN 12")).toBeTruthy();
    expect(screen.getByTestId("handoff-undo")).toBeTruthy();
    expect(screen.queryByText("Đã thanh toán xong chưa?")).toBeNull();
    expect(screen.queryByTestId("handoff-reopen")).toBeNull();
    expect(screen.queryByTestId("handoff-qr-deleted")).toBeNull();
  });

  it("TPBank with album image shows the deleted line and Mở lại TPBank, which starts a new hand-off", async () => {
    const { tx } = await setup();
    mockStart.mockResolvedValue({ opened: true });
    await act(async () => {
      usePendingHandOff.getState().set({ txId: tx.id, amount: 55000, label: "PHO HOA BAN 12" });
      usePendingHandOff.getState().setReopen(reopenOf(true));
      usePendingHandOff.getState().reveal();
    });
    expect(screen.getByText("Đã xoá ảnh QR tạm khỏi Ảnh")).toBeTruthy();
    expect(screen.getByText("Mở lại TPBank")).toBeTruthy();
    await act(async () => fireEvent.press(screen.getByTestId("handoff-reopen")));
    expect(mockStart).toHaveBeenCalledTimes(1);
    expect(mockStart.mock.calls[0][1]).toMatchObject({ app: tpb, amount: 55000, txId: tx.id });
    expect(usePendingHandOff.getState()).toMatchObject({ visible: false, pending: { txId: tx.id } });
  });

  it("without an album image only Mở lại is offered", async () => {
    const { tx } = await setup();
    await act(async () => {
      usePendingHandOff.getState().set({ txId: tx.id, amount: 55000, label: "x" });
      usePendingHandOff.getState().setReopen(reopenOf(false));
      usePendingHandOff.getState().reveal();
    });
    expect(screen.queryByTestId("handoff-qr-deleted")).toBeNull();
    expect(screen.getByTestId("handoff-reopen")).toBeTruthy();
  });

  it("Hoàn tác soft-deletes the transaction", async () => {
    const { repo, tx } = await setup();
    await act(async () => {
      usePendingHandOff.getState().set({ txId: tx.id, amount: 55000, label: "PHO 24" });
      usePendingHandOff.getState().reveal();
    });
    expect(await repo.list()).toHaveLength(1);
    await act(async () => fireEvent.press(screen.getByTestId("handoff-undo")));
    await waitFor(() => expect(screen.queryByTestId("handoff-return-banner")).toBeNull());
    expect(await repo.list()).toHaveLength(0);
    expect(usePendingHandOff.getState().deletedVersion).toBe(1);
  });

  it("Hoàn tác drops the amount from the month total", async () => {
    const { repo, tx, db } = await setup();
    const repos = {
      transactions: repo,
      categories: createCategoryRepository(db),
      groupExpenses: createGroupExpenseRepository(db),
    };
    const month = monthKeyOf(tx.occurred_at);
    expect((await loadCategoryBreakdown(repos, month, "expense")).total).toBe(55000);
    await act(async () => {
      usePendingHandOff.getState().set({ txId: tx.id, amount: 55000, label: "PHO 24" });
      usePendingHandOff.getState().reveal();
    });
    await act(async () => fireEvent.press(screen.getByTestId("handoff-undo")));
    await waitFor(() => expect(screen.queryByTestId("handoff-return-banner")).toBeNull());
    expect((await loadCategoryBreakdown(repos, month, "expense")).total).toBe(0);
  });

  it("auto-hides after HIDE_AFTER_MS and the transaction stays", async () => {
    jest.useFakeTimers();
    try {
      const { repo, tx } = await setup();
      await act(async () => {
        usePendingHandOff.getState().set({ txId: tx.id, amount: 55000, label: "PHO 24" });
        usePendingHandOff.getState().reveal();
      });
      await act(async () => jest.advanceTimersByTime(HIDE_AFTER_MS + 100));
      expect(screen.queryByTestId("handoff-return-banner")).toBeNull();
      expect(await repo.list()).toHaveLength(1);
    } finally {
      jest.useRealTimers();
    }
  });

  it("shows right away when revealed (open failed)", async () => {
    const { tx } = await setup();
    await act(async () => {
      usePendingHandOff.getState().set({ txId: tx.id, amount: 55000, label: "PHO 24" });
      usePendingHandOff.getState().reveal();
    });
    expect(screen.getByTestId("handoff-return-banner")).toBeTruthy();
  });

  it("records the return on the pending hand-off when the app comes back", async () => {
    const { tx, db } = await setup();
    const repo = createHandOffRepository(db);
    const ho = await repo.create({
      transaction_id: tx.id,
      app_id: "mb",
      method: "autofill",
      started_at: new Date(Date.now() - 90_000),
    });
    await act(async () => {
      usePendingHandOff.getState().set({ txId: tx.id, amount: 55000, label: "PHO 24", handOffId: ho.id });
    });
    await act(async () => handler("background"));
    await act(async () => handler("active"));
    await waitFor(async () => expect((await repo.get(ho.id))?.paid_signal).toBe("time"));
    expect((await repo.get(ho.id))?.returned_at).not.toBeNull();
  });
});
