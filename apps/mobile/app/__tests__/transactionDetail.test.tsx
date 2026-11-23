import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { Alert } from "react-native";

import { fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";

import { createGroupExpenseRepository, createGroupRepository, createTransactionRepository } from "@/db/repositories";
import type { AnyDb } from "@/db/seed";
import { openTestDb } from "@/db/testing/testDb";
import { generateVietQr } from "@/lib/vietqr";
import { catId } from "@/testing/repoTestUtils";

jest.mock("@expo-google-fonts/inter", () => ({ useFonts: () => [true, null] }));
jest.mock("@/db/DatabaseProvider", () => ({
  DatabaseProvider: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock("@/db/client", () => {
  const db = new Proxy({}, { get: (_t, key) => (global.__DETAIL_TEST_DB__ as never)[key] });
  return { db };
});

declare global {
  var __DETAIL_TEST_DB__: object;
}

let file: string;

beforeEach(() => {
  // Fake only Date: "now" is Sun 22/11/2026 12:00 VN.
  jest.useFakeTimers({
    now: new Date("2026-11-22T05:00:00Z"),
    doNotFake: [
      "setTimeout",
      "clearTimeout",
      "setInterval",
      "clearInterval",
      "setImmediate",
      "clearImmediate",
      "nextTick",
      "queueMicrotask",
      "requestAnimationFrame",
      "cancelAnimationFrame",
      "performance",
      "hrtime",
    ],
  });
  file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "mm-detail-")), "test.db");
  global.__DETAIL_TEST_DB__ = openTestDb(file).db;
});
afterEach(() => jest.useRealTimers());

const repo = () => createTransactionRepository(global.__DETAIL_TEST_DB__ as unknown as AnyDb);
const reopened = () => createTransactionRepository(openTestDb(file).db as unknown as AnyDb);

async function add(
  amount: number,
  occurred_at: string,
  extra: {
    note?: string;
    photo_uri?: string;
    qr_data?: string;
    source?: "manual" | "qr";
    type?: "expense" | "income";
    cat?: string;
    money_source?: string;
  } = {},
) {
  const type = extra.type ?? "expense";
  return repo().create({
    type,
    amount,
    occurred_at,
    note: extra.note ?? "",
    money_source: extra.money_source,
    photo_uri: extra.photo_uri,
    qr_data: extra.qr_data,
    source: extra.source,
    category_id: catId(extra.cat ?? (type === "expense" ? "Ăn uống" : "Lương"), type),
  });
}

async function open(id: string, from = "/history") {
  await renderRouter("./app", { initialUrl: from });
  if (from === "/history") {
    await fireEvent.press(await screen.findByTestId(`history-open-${id}`));
  } else if (from === "/") {
    await fireEvent.press(await screen.findByTestId(`overview-open-${id}`));
  }
  await screen.findByTestId("screen-transaction-detail");
}

describe("Chi tiết giao dịch screen", () => {
  it("AC1/AC4: History row opens the detail with all fields", async () => {
    const t = await add(50_000, "2026-11-21T07:02:00Z", {
      note: "phở bò",
      photo_uri: "file:///bill.jpg",
      money_source: "Ngân hàng",
    });
    await open(t.id);
    expect(await screen.findByText("−50.000đ")).toBeTruthy();
    expect(screen.getByTestId("detail-category").props.children).toBe("Ăn uống");
    expect(screen.getByText("21/11/2026, 14:02")).toBeTruthy();
    expect(screen.getByTestId("detail-note").props.children).toBe("phở bò");
    expect(screen.getByTestId("detail-money-source").props.children).toBe("Ngân hàng");
    expect(screen.getByTestId("detail-source").props.children).toBe("Nhập tay");
    expect(screen.getByTestId("detail-photo")).toBeTruthy();
  });

  it("AC4: Overview recent row opens the detail", async () => {
    const t = await add(30_000, "2026-11-21T07:02:00Z", { note: "xăng" });
    await open(t.id, "/");
    expect(await screen.findByText("−30.000đ")).toBeTruthy();
  });

  it("shows the scanned QR card with payee and message", async () => {
    const qr_data = generateVietQr({
      bankBin: "970436",
      account: "0123456789",
      name: "KS DALAT",
      message: "DAT PHONG",
    });
    const t = await add(2_400_000, "2026-11-21T07:02:00Z", { qr_data, source: "qr" });
    await open(t.id);
    expect(await screen.findByTestId("detail-qr")).toBeTruthy();
    expect(screen.getByText("Nội dung: DAT PHONG")).toBeTruthy();
    expect(screen.getByTestId("detail-payee").props.children).toBe("KS DALAT · 0123456789");
    expect(screen.getByTestId("detail-source").props.children).toBe("QR · Vietcombank");
    expect(screen.queryByTestId("detail-photo")).toBeNull();
  });

  it("shows not-found for an unknown id", async () => {
    await renderRouter("./app", { initialUrl: "/transaction/missing" });
    expect(await screen.findByTestId("detail-not-found")).toBeTruthy();
  });

  it("AC2: edit updates the detail and History", async () => {
    const t = await add(50_000, "2026-11-21T07:02:00Z", { note: "phở bò" });
    await open(t.id);
    await screen.findByText("−50.000đ");
    await fireEvent.press(screen.getByTestId("detail-edit"));
    const input = await screen.findByTestId("amount-input");
    await fireEvent.changeText(input, "60000");
    await fireEvent.press(screen.getByTestId("save-button"));
    expect(await screen.findByText("−60.000đ")).toBeTruthy();
    expect(screen.queryByText("−50.000đ")).toBeNull();
    await fireEvent.press(screen.getByTestId("detail-back"));
    await screen.findByTestId("screen-history");
    expect(await screen.findByText("−60.000đ")).toBeTruthy();
    expect(screen.queryByText("−50.000đ")).toBeNull();
  });

  describe("AC3: delete", () => {
    const pressButton = (text: string) => {
      const spy = jest.spyOn(Alert, "alert").mockImplementation((_t, _m, buttons) => {
        buttons?.find((b) => b.text === text)?.onPress?.();
      });
      return spy;
    };
    afterEach(() => jest.restoreAllMocks());

    it("confirm soft-deletes and returns to History", async () => {
      const t = await add(50_000, "2026-11-21T07:02:00Z", { note: "phở bò" });
      await open(t.id);
      await screen.findByText("−50.000đ");
      pressButton("Xóa");
      await fireEvent.press(screen.getByTestId("detail-delete"));
      await screen.findByTestId("screen-history");
      await waitFor(() => expect(screen.queryByText("phở bò")).toBeNull());
      expect(await repo().list()).toEqual([]);
      expect(await repo().getById(t.id)).toBeNull();
    });

    it("cancel leaves the transaction untouched", async () => {
      const t = await add(50_000, "2026-11-21T07:02:00Z", { note: "phở bò" });
      await open(t.id);
      await screen.findByText("−50.000đ");
      const spy = pressButton("Hủy");
      await fireEvent.press(screen.getByTestId("detail-delete"));
      expect(spy).toHaveBeenCalled();
      expect(screen.getByTestId("screen-transaction-detail")).toBeTruthy();
      expect((await repo().getById(t.id))?.deleted_at).toBeNull();
    });
  });

  describe("group expense", () => {
    const db = () => global.__DETAIL_TEST_DB__ as unknown as AnyDb;
    async function groupExpense(amount = 1_000_000) {
      const groups = createGroupRepository(db());
      const exp = createGroupExpenseRepository(db());
      const g = await groups.createGroup({ name: "Đà Lạt", members: ["An", "Bình"] });
      const [me, an, binh] = g.members.map((m) => m.id);
      const t = await exp.createGroupExpense({
        groupId: g.id,
        amount,
        payerMemberId: an,
        splitMode: "equal",
        shares: [{ memberId: me }, { memberId: an }, { memberId: binh }],
        occurredAt: "2026-11-21T07:02:00Z",
        note: "khách sạn",
      });
      return { exp, t, me, an, binh };
    }

    it("AC1: shows group badge, payer and every share", async () => {
      const { t, me, an, binh } = await groupExpense();
      await open(t.id);
      expect((await screen.findByTestId("detail-group-badge")).props.children).toBe("Nhóm: Đà Lạt");
      expect(screen.getByTestId("detail-payer").props.children).toBe("An");
      expect(screen.getByTestId("detail-split-mode").props.children).toBe("Chia đều · 3 người");
      // 1.000.000 / 3: remainder goes to the first share (Tôi)
      expect(screen.getByTestId(`detail-share-${me}`).props.children).toBe("333.334đ");
      expect(screen.getByTestId(`detail-share-${an}`).props.children).toBe("333.333đ");
      expect(screen.getByTestId(`detail-share-${binh}`).props.children).toBe("333.333đ");
    });

    it("personal transactions have no split card", async () => {
      const t = await add(50_000, "2026-11-21T07:02:00Z");
      await open(t.id);
      await screen.findByText("−50.000đ");
      expect(screen.queryByTestId("detail-split")).toBeNull();
    });

    it("AC2: editing the amount recomputes the shares", async () => {
      const { t, exp, me, an } = await groupExpense();
      await open(t.id);
      await screen.findByTestId("detail-split");
      await fireEvent.press(screen.getByTestId("detail-edit"));
      await fireEvent.changeText(await screen.findByTestId("amount-input"), "900000");
      await fireEvent.press(screen.getByTestId("save-button"));
      expect(await screen.findByText("−900.000đ")).toBeTruthy();
      await waitFor(() => expect(screen.getByTestId(`detail-share-${me}`).props.children).toBe("300.000đ"));
      expect(screen.getByTestId(`detail-share-${an}`).props.children).toBe("300.000đ");
      expect((await exp.getShares(t.id)).map((x) => x.amount)).toEqual([300_000, 300_000, 300_000]);
    });

    it("AC4: delete soft-deletes the transaction", async () => {
      const { t } = await groupExpense();
      await open(t.id);
      await screen.findByTestId("detail-split");
      jest.spyOn(Alert, "alert").mockImplementation((_t, _m, buttons) => {
        buttons?.find((b) => b.text === "Xóa")?.onPress?.();
      });
      await fireEvent.press(screen.getByTestId("detail-delete"));
      await screen.findByTestId("screen-history");
      expect(await repo().getById(t.id)).toBeNull();
      jest.restoreAllMocks();
    });
  });
});
