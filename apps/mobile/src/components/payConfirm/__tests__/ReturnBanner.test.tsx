import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { AppState } from "react-native";

import { RepositoriesProvider } from "@/db/RepositoriesProvider";
import {
  createCategoryRepository,
  createHandOffMemoryRepository,
  createHandOffRepository,
  createTransactionRepository,
} from "@/db/repositories";
import type { AnyDb } from "@/db/seed";
import { openTestDb } from "@/db/testing/testDb";
import { usePendingHandOff } from "@/stores/pendingHandOff";

import { ReturnBanner } from "../ReturnBanner";

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

describe("ReturnBanner", () => {
  it("is hidden until the app returns from background, then Xóa soft-deletes", async () => {
    const { repo, tx } = await setup();
    await act(async () => usePendingHandOff.getState().set({ txId: tx.id, amount: 55000, label: "PHO 24" }));
    await act(async () => usePendingHandOff.getState().showQrHint());
    expect(screen.queryByTestId("handoff-return-banner")).toBeNull();
    await act(async () => handler("background"));
    await act(async () => handler("active"));
    expect(await screen.findByText("Đã lưu 55.000đ · PHO 24")).toBeTruthy();
    expect(screen.getByTestId("handoff-qr-hint").props.children).toBe(
      "Đã lưu mã QR vào Ảnh. Trong app ngân hàng, chọn Quét QR → chọn ảnh để tự điền.",
    );
    expect(await repo.list()).toHaveLength(1);
    await act(async () => fireEvent.press(screen.getByTestId("handoff-delete")));
    await waitFor(() => expect(screen.queryByTestId("handoff-return-banner")).toBeNull());
    expect(await repo.list()).toHaveLength(0);
    expect(usePendingHandOff.getState().deletedVersion).toBe(1);
  });

  it("autofill hand-off: no QR hint in the banner", async () => {
    const { tx } = await setup();
    await act(async () => {
      usePendingHandOff.getState().set({ txId: tx.id, amount: 55000, label: "PHO 24" });
      usePendingHandOff.getState().reveal();
    });
    expect(screen.queryByTestId("handoff-qr-hint")).toBeNull();
  });

  it("shows right away when revealed (open failed)", async () => {
    const { tx } = await setup();
    await act(async () => {
      usePendingHandOff.getState().set({ txId: tx.id, amount: 55000, label: "PHO 24" });
      usePendingHandOff.getState().reveal();
    });
    expect(screen.getByTestId("handoff-return-banner")).toBeTruthy();
  });

  it.each([
    ["handoff-paid-yes", "share_ok"],
    ["handoff-paid-no", "share_failed"],
  ])("asks 'Đã thanh toán xong chưa?' once; %s stores %s", async (button, expected) => {
    const { tx, db } = await setup();
    await act(async () => {
      usePendingHandOff.getState().set({ txId: tx.id, amount: 55000, label: "PHO 24" });
      usePendingHandOff.getState().askPaid("tcb");
      usePendingHandOff.getState().reveal();
    });
    expect(screen.getByText("Đã thanh toán xong chưa?")).toBeTruthy();
    await act(async () => fireEvent.press(screen.getByTestId(button)));
    expect(screen.queryByTestId("handoff-ask-paid")).toBeNull();
    expect(await createHandOffMemoryRepository(db).getShareMemory()).toEqual({ tcb: expected });
    // Coming back again does not ask again.
    await act(async () => handler("background"));
    await act(async () => handler("active"));
    expect(screen.queryByTestId("handoff-ask-paid")).toBeNull();
  });

  it("keeps the question open past the auto-hide delay", async () => {
    jest.useFakeTimers();
    try {
      const { tx } = await setup();
      await act(async () => {
        usePendingHandOff.getState().set({ txId: tx.id, amount: 55000, label: "PHO 24" });
        usePendingHandOff.getState().askPaid("tcb");
        usePendingHandOff.getState().reveal();
      });
      await act(async () => jest.advanceTimersByTime(20000));
      expect(screen.getByTestId("handoff-ask-paid")).toBeTruthy();
    } finally {
      jest.useRealTimers();
    }
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
