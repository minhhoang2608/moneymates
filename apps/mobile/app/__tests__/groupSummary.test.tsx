import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { Alert } from "react-native";

import { fireEvent, renderRouter, screen, waitFor, within } from "expo-router/testing-library";

import * as MediaLibrary from "expo-media-library/legacy";
import * as Sharing from "expo-sharing";

import {
  createBankAccountRepository,
  createCategoryRepository,
  createGroupExpenseRepository,
  createGroupRepository,
  createProfileRepository,
  createSettlementRepository,
  createTransactionRepository,
} from "@/db/repositories";
import { loadOverview } from "@/lib/stats/loadOverview";
import type { AnyDb } from "@/db/seed";
import { generateVietQr } from "@/lib/vietqr";
import { openTestDb } from "@/db/testing/testDb";

jest.mock("@expo-google-fonts/inter", () => ({ useFonts: () => [true, null] }));
jest.mock("@/db/DatabaseProvider", () => ({
  DatabaseProvider: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock("@/db/client", () => {
  const db = new Proxy({}, { get: (_t, key) => (global.__GSUM_TEST_DB__ as never)[key] });
  return { db };
});

declare global {
  var __GSUM_TEST_DB__: object;
}

let file: string;
beforeEach(() => {
  file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "mm-gsum-")), "test.db");
  global.__GSUM_TEST_DB__ = openTestDb(file).db;
});
const realFetch = global.fetch;
afterEach(() => {
  jest.restoreAllMocks();
  global.fetch = realFetch;
});

const d = () => openTestDb(file).db as unknown as AnyDb;

async function setup(names = ["An", "Bình"], withAccount = false) {
  await createProfileRepository(d()).setDisplayName("Hoàng");
  if (withAccount) {
    await createBankAccountRepository(d()).addAccount({
      bank_bin: "970423",
      account_no: "0123456789",
      account_name: "HOANG LE",
    });
  }
  const g = await createGroupRepository(d()).createGroup({ name: "Đà Lạt", members: names });
  return { g, me: g.members[0].id, an: g.members[1].id, binh: g.members[2]?.id };
}
async function expense(groupId: string, payer: string, amount: number, members: string[], note: string) {
  await createGroupExpenseRepository(d()).createGroupExpense({
    groupId,
    amount,
    payerMemberId: payer,
    splitMode: "equal",
    shares: members.map((memberId) => ({ memberId })),
    occurredAt: "2026-11-20T08:00:00Z",
    note,
  });
}
async function open(id: string) {
  await renderRouter("./app", { initialUrl: `/group/summary?id=${id}` });
  await screen.findByTestId("screen-group-summary");
}
const rowTexts = (testID: string) =>
  within(screen.getByTestId(testID))
    .getAllByText(/.*/)
    .map((n) => String(([] as unknown[]).concat(n.props.children).join("")));
const overviewTotals = async () => {
  const repos = { transactions: createTransactionRepository(d()), categories: createCategoryRepository(d()) };
  const o = (await loadOverview(repos as never, { now: new Date("2026-11-22T05:00:00Z") })).overview;
  return { expense: o.expenseTotal, income: o.incomeTotal };
};
const text = (testID: string) => {
  const flat = (n: unknown): string => (typeof n === "string" ? n : Array.isArray(n) ? n.map(flat).join("") : "");
  return flat(screen.getByTestId(testID).props.children);
};

describe("Tổng kết nhóm", () => {
  it("AC1: table shows paid, owed and signed balance", async () => {
    const { g, me, an, binh } = await setup();
    await expense(g.id, me, 900000, [me, an, binh], "Khách sạn");
    await expense(g.id, binh, 300000, [me, an, binh], "Lẩu");
    await open(g.id);
    await screen.findByText("+500.000đ");
    expect(rowTexts(`summary-row-${me}`)).toEqual(["Tôi", "900.000đ", "400.000đ", "+500.000đ"]);
    expect(rowTexts(`summary-row-${an}`)).toEqual(["An", "0đ", "400.000đ", "−400.000đ"]);
    expect(rowTexts(`summary-row-${binh}`)).toEqual(["Bình", "300.000đ", "400.000đ", "−100.000đ"]);
    expect(screen.getByTestId("summary-subtitle").props.children).toBe("Đà Lạt · 1.200.000đ");
  });

  it("AC2: settlement list and QR only for items paid to Tôi", async () => {
    const { g, me, an, binh } = await setup();
    await expense(g.id, binh, 600000, [me, an, binh], "Nhà hàng");
    await open(g.id);
    await screen.findByText("An trả Tôi 200.000đ");
    expect(screen.getByText("Tôi trả Bình 400.000đ")).toBeTruthy();
    expect(screen.getByTestId(`qr-${an}`)).toBeTruthy();
    expect(screen.queryByTestId(`qr-${binh}`)).toBeNull();
    expect(text("summary-remaining")).toBe("200.000đ");
  });

  it("AC3: Đã trả removes the item and keeps totals", async () => {
    const { g, me, an, binh } = await setup();
    await expense(g.id, me, 900000, [me, an, binh], "Khách sạn");
    await open(g.id);
    await screen.findByTestId(`settle-item-${an}`);
    const before = await overviewTotals();
    await fireEvent.press(screen.getByTestId(`mark-paid-${an}`));
    await waitFor(() => expect(screen.queryByTestId(`settle-item-${an}`)).toBeNull());
    expect(screen.getByTestId(`settle-item-${binh}`)).toBeTruthy();
    expect(screen.getByTestId("summary-subtitle").props.children).toBe("Đà Lạt · 900.000đ");
    expect(text("summary-remaining")).toBe("300.000đ");
    expect(rowTexts(`summary-row-${an}`)[3]).toBe("0đ");
    expect(await overviewTotals()).toEqual(before);
  });

  it("Maestro scenario: 900.000đ split equally, no receiving account, mark An paid", async () => {
    const { g, me, an, binh } = await setup();
    await expense(g.id, me, 900000, [me, an, binh], "Ăn uống");
    await open(g.id);
    await screen.findByText("An trả Tôi 300.000đ");
    expect(rowTexts(`summary-row-${me}`)[3]).toBe("+600.000đ");
    expect(screen.getByText("Bình trả Tôi 300.000đ")).toBeTruthy();
    expect(text("summary-remaining")).toBe("600.000đ");
    expect(screen.getByText("Còn phải thu")).toBeTruthy();
    expect(screen.getByTestId(`mark-paid-${an}`)).toBeTruthy();
    await fireEvent.press(screen.getByTestId(`mark-paid-${an}`));
    await waitFor(() => expect(screen.queryByText("An trả Tôi 300.000đ")).toBeNull());
    expect(screen.getByText("Bình trả Tôi 300.000đ")).toBeTruthy();
    expect(text("summary-remaining")).toBe("300.000đ");
  });

  it("markPaid failure shows an alert and reloads", async () => {
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    const { g, me, an, binh } = await setup();
    await expense(g.id, me, 900000, [me, an, binh], "Khách sạn");
    await open(g.id);
    await screen.findByTestId(`settle-item-${an}`);
    // Settle behind the screen's back so its list is stale: the second payment throws.
    await createSettlementRepository(d()).markPaid(g.id, an, 300000);
    await fireEvent.press(screen.getByTestId(`mark-paid-${an}`));
    await waitFor(() => expect(alertSpy).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.queryByTestId(`settle-item-${an}`)).toBeNull());
  });

  it("AC4: empty group shows zeros and no items", async () => {
    const { g } = await setup();
    await open(g.id);
    await screen.findByTestId("settle-empty");
    expect(screen.getAllByText("0đ").length).toBeGreaterThanOrEqual(7);
    expect(screen.queryByTestId(/^settle-item-/)).toBeNull();
    expect(text("summary-remaining")).toBe("0đ");
  });

  it("AC5: tapping a person lists their expenses", async () => {
    const { g, me, an, binh } = await setup();
    await expense(g.id, me, 900000, [me, an, binh], "Khách sạn");
    await expense(g.id, binh, 300000, [binh, an], "Lẩu");
    await expense(g.id, me, 100000, [me, an], "Taxi");
    await open(g.id);
    await fireEvent.press(await screen.findByTestId(`summary-row-${binh}`));
    await screen.findByTestId("member-expenses-sheet");
    const list = await createGroupExpenseRepository(d()).listGroupExpenses(g.id);
    const hotel = list.find((x) => x.note === "Khách sạn")!;
    const lau = list.find((x) => x.note === "Lẩu")!;
    const taxi = list.find((x) => x.note === "Taxi")!;
    expect(screen.queryByTestId(`member-expense-${taxi.id}`)).toBeNull();
    expect(screen.getByTestId(`member-expense-${hotel.id}`)).toBeTruthy();
    expect(screen.getByTestId(`member-expense-${lau.id}`)).toBeTruthy();
    expect(rowTexts(`member-expense-${hotel.id}`)).toEqual([
      "Khách sạn",
      "20/11/2026 · phải chịu 300.000đ",
      "900.000đ",
    ]);
    expect(rowTexts(`member-expense-${lau.id}`)).toEqual([
      "Lẩu",
      "20/11/2026 · đã chi · phải chịu 150.000đ",
      "300.000đ",
    ]);
    await fireEvent.press(screen.getByTestId("member-expenses-close"));
    await fireEvent.press(screen.getByTestId(`summary-row-${an}`));
    await screen.findByTestId("member-expenses-sheet");
    expect(screen.getByTestId(`member-expense-${taxi.id}`)).toBeTruthy();
    await fireEvent.press(screen.getByTestId("member-expenses-close"));
  });

  it("AC6: works offline without fetch; QR buttons open the popup", async () => {
    const fetchSpy = jest.fn();
    (global as { fetch?: unknown }).fetch = fetchSpy;
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    const { g, me, an, binh } = await setup();
    await expense(g.id, me, 900000, [me, an, binh], "Khách sạn");
    await open(g.id);
    await fireEvent.press(await screen.findByTestId(`qr-${an}`));
    expect(await screen.findByTestId("qr-popup")).toBeTruthy();
    await fireEvent.press(screen.getByTestId("qr-popup-close"));
    await fireEvent.press(screen.getByTestId("qr-group"));
    expect(await screen.findByText("QR chung")).toBeTruthy();
    expect(alertSpy).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("unknown group shows not-found", async () => {
    await setup();
    await open("missing");
    expect(await screen.findByTestId("group-not-found")).toBeTruthy();
  });

  describe("QR popup", () => {
    const expected = (amount?: number, message?: string) =>
      generateVietQr({ bankBin: "970423", account: "0123456789", name: "HOANG LE", amount, message });

    it("opens a member QR with the amount, message and fetch never called", async () => {
      const fetchSpy = jest.fn();
      global.fetch = fetchSpy as never;
      const { g, me, an, binh } = await setup(["An", "Bình"], true);
      await expense(g.id, me, 900000, [me, an, binh], "Khách sạn");
      await open(g.id);
      await fireEvent.press(await screen.findByTestId(`qr-${an}`));
      const code = await screen.findByTestId("qr-popup-code");
      expect(code.props.accessibilityLabel).toBe(expected(300000, "Đà Lạt An"));
      expect(screen.getByText("Đòi tiền An")).toBeTruthy();
      expect(within(screen.getByTestId("qr-popup")).getByText("300.000đ")).toBeTruthy();
      expect(screen.getByText("Nội dung: Da Lat An")).toBeTruthy();
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("download and share use the QR image", async () => {
      const { g, me, an, binh } = await setup(["An", "Bình"], true);
      await expense(g.id, me, 900000, [me, an, binh], "Khách sạn");
      await open(g.id);
      await fireEvent.press(await screen.findByTestId(`qr-${an}`));
      await fireEvent.press(await screen.findByTestId("qr-download"));
      await waitFor(() => expect(MediaLibrary.saveToLibraryAsync).toHaveBeenCalled());
      await fireEvent.press(screen.getByTestId("qr-share"));
      await waitFor(() => expect(Sharing.shareAsync).toHaveBeenCalled());
    });

    it("QR chung from the footer has no amount; the tab switches the payload", async () => {
      const { g, me, an, binh } = await setup(["An", "Bình"], true);
      await expense(g.id, me, 900000, [me, an, binh], "Khách sạn");
      await open(g.id);
      await fireEvent.press(await screen.findByTestId("qr-group"));
      const code = await screen.findByTestId("qr-popup-code");
      expect(code.props.accessibilityLabel).toBe(expected(undefined, "Đà Lạt"));
      expect(screen.queryByTestId("qr-tab-member")).toBeNull();
      expect(screen.getByTestId("qr-download")).toBeTruthy();
      expect(screen.getByTestId("qr-share")).toBeTruthy();
      await fireEvent.press(screen.getByTestId("qr-popup-close"));
      await fireEvent.press(screen.getByTestId(`qr-${an}`));
      await fireEvent.press(await screen.findByTestId("qr-tab-group"));
      expect(screen.getByTestId("qr-popup-code").props.accessibilityLabel).toBe(expected(undefined, "Đà Lạt"));
    });

    it("without a receiving account it prompts to add one", async () => {
      const { g, me, an, binh } = await setup(["An", "Bình"], false);
      await expense(g.id, me, 900000, [me, an, binh], "Khách sạn");
      await open(g.id);
      await fireEvent.press(await screen.findByTestId(`qr-${an}`));
      expect(await screen.findByTestId("qr-add-account")).toBeTruthy();
      expect(screen.queryByTestId("qr-popup-code")).toBeNull();
      await fireEvent.press(screen.getByTestId("qr-add-account"));
      await waitFor(() => expect(screen.getByTestId("screen-bank-accounts")).toBeTruthy());
    });

    it("a soft-deleted receiving account also prompts", async () => {
      const { g, me, an, binh } = await setup(["An", "Bình"], true);
      await expense(g.id, me, 900000, [me, an, binh], "Khách sạn");
      const acc = await createBankAccountRepository(d()).getDefaultAccount();
      await createBankAccountRepository(d()).deleteAccount(acc!.id);
      await open(g.id);
      await fireEvent.press(await screen.findByTestId("qr-group"));
      expect(await screen.findByTestId("qr-add-account")).toBeTruthy();
      expect(screen.queryByTestId("qr-popup-code")).toBeNull();
    });
  });
});
