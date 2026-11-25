import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { StyleSheet } from "react-native";
import { act, fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";

import {
  createGroupExpenseRepository,
  createGroupRepository,
  createPreferencesRepository,
  createTransactionRepository,
} from "@/db/repositories";
import type { AnyDb } from "@/db/seed";
import { openTestDb } from "@/db/testing/testDb";
import { catId } from "@/testing/repoTestUtils";
import { colors, overlays } from "@/theme";

jest.mock("@expo-google-fonts/inter", () => ({ useFonts: () => [true, null] }));
jest.mock("@/db/DatabaseProvider", () => ({
  DatabaseProvider: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock("@/db/client", () => {
  const db = new Proxy({}, { get: (_t, key) => (global.__OVERVIEW_TEST_DB__ as never)[key] });
  return { db };
});

declare global {
  var __OVERVIEW_TEST_DB__: object;
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
  file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "mm-overview-")), "test.db");
  global.__OVERVIEW_TEST_DB__ = openTestDb(file).db;
});
afterEach(() => jest.useRealTimers());

const repo = () => createTransactionRepository(global.__OVERVIEW_TEST_DB__ as unknown as AnyDb);

const add = (amount: number, occurred_at: string, type: "expense" | "income" = "expense", cat?: string) =>
  repo().create({
    type,
    amount,
    occurred_at,
    note: "",
    category_id: catId(cat ?? (type === "expense" ? "Ăn uống" : "Lương"), type),
  });

const text = (id: string) => screen.getByTestId(id).props.children;

async function renderOverview() {
  await renderRouter("./app", { initialUrl: "/" });
  await screen.findByTestId("screen-overview");
}

describe("Tổng quan screen", () => {
  it("shows the Nhập tay / Voice / Chụp bill row and opens manual entry", async () => {
    await add(50_000, "2026-11-05T03:00:00Z");
    await renderOverview();
    await screen.findByTestId("overview-recent");
    for (const id of ["manual", "voice", "bill"]) expect(screen.getByTestId(`overview-entry-${id}`)).toBeTruthy();
    const style = StyleSheet.flatten(screen.getByTestId("overview-entry-manual").props.style);
    expect(style.borderColor).toBe(colors.border);
    await fireEvent.press(screen.getByTestId("overview-entry-manual"));
    await screen.findByTestId("amount-input");
  });

  it("AC1: shows monthly expense and income", async () => {
    await add(50_000, "2026-11-05T03:00:00Z");
    await add(150_000, "2026-11-06T03:00:00Z");
    await add(25_000_000, "2026-11-01T03:00:00Z", "income");
    await renderOverview();
    await waitFor(() => expect(text("overview-expense")).toBe("200.000đ"));
    expect(text("overview-income")).toBe("25.000.000đ");
    expect(screen.getByText("Tháng 11/2026")).toBeTruthy();
  });

  it("AC2: banner shows above 20% and is absent otherwise", async () => {
    await add(10_000_000, "2026-10-05T03:00:00Z");
    await add(12_500_000, "2026-11-05T03:00:00Z");
    await renderOverview();
    expect(await screen.findByTestId("overview-banner")).toBeTruthy();
    expect(screen.getByText(/cao hơn tháng trước 25%/)).toBeTruthy();
  });

  it("AC4: the alert toggle off hides the banner", async () => {
    const prefs = createPreferencesRepository(global.__OVERVIEW_TEST_DB__ as unknown as AnyDb);
    await add(1_000_000, "2026-10-05T03:00:00Z");
    await add(1_250_000, "2026-11-05T03:00:00Z");
    await prefs.setAlertOverLastMonth(false);
    await renderOverview();
    await waitFor(() => expect(text("overview-expense")).toBe("1.250.000đ"));
    expect(screen.queryByTestId("overview-banner")).toBeNull();
  });

  it("AC4: banner shows up with the toggle on", async () => {
    const prefs = createPreferencesRepository(global.__OVERVIEW_TEST_DB__ as unknown as AnyDb);
    await add(1_000_000, "2026-10-05T03:00:00Z");
    await add(1_250_000, "2026-11-05T03:00:00Z");
    await prefs.setAlertOverLastMonth(true);
    await renderOverview();
    expect(await screen.findByTestId("overview-banner")).toBeTruthy();
    expect(screen.getByText(/cao hơn tháng trước 25%/)).toBeTruthy();
  });

  it("AC2: no banner at +10%", async () => {
    await add(10_000_000, "2026-10-05T03:00:00Z");
    await add(11_000_000, "2026-11-05T03:00:00Z");
    await renderOverview();
    await waitFor(() => expect(text("overview-expense")).toBe("11.000.000đ"));
    expect(screen.queryByTestId("overview-banner")).toBeNull();
  });

  it("AC3: five recent rows; pressing one opens the detail", async () => {
    const ids: string[] = [];
    for (let i = 1; i <= 7; i++) ids.push((await add(i * 1000, `2026-11-0${i}T03:00:00Z`)).id);
    await renderOverview();
    await screen.findByTestId(`overview-open-${ids[6]}`);
    expect(screen.getAllByTestId(/^overview-open-/)).toHaveLength(5);
    await fireEvent.press(screen.getByTestId(`overview-open-${ids[6]}`));
    await screen.findByTestId("screen-transaction-detail");
  });

  it("AC4: legend ordered by amount", async () => {
    await add(300_000, "2026-11-02T03:00:00Z", "expense", "Mua sắm");
    await add(500_000, "2026-11-03T03:00:00Z", "expense", "Ăn uống");
    await add(400_000, "2026-11-04T03:00:00Z", "expense", "Di chuyển");
    await renderOverview();
    await screen.findByTestId("overview-top-0");
    const legend = screen.getAllByTestId(/^overview-top-\d/);
    expect(legend).toHaveLength(3);
    expect(screen.getByTestId("overview-top-0")).toHaveTextContent(/^Ăn uống/);
    expect(screen.getByTestId("overview-top-1")).toHaveTextContent(/^Di chuyển/);
    expect(screen.getByTestId("overview-top-2")).toHaveTextContent(/^Mua sắm/);
  });

  it("AC5: empty database shows zero, empty state and no banner", async () => {
    await renderOverview();
    expect(await screen.findByText("Chưa có giao dịch nào")).toBeTruthy();
    expect(text("overview-expense")).toBe("0đ");
    expect(screen.queryByTestId("overview-banner")).toBeNull();
  });

  it("the Thống kê link opens the stats screen", async () => {
    await add(50_000, "2026-11-05T03:00:00Z");
    await renderOverview();
    await fireEvent.press(await screen.findByTestId("overview-stats-link"));
    await screen.findByTestId("screen-stats");
  });

  it("the + button opens the menu and manual entry", async () => {
    await renderOverview();
    await fireEvent.press(screen.getByTestId("overview-add-button"));
    await fireEvent.press(await screen.findByTestId("entry-menu-manual"));
    await waitFor(() => expect(screen.getByTestId("amount-input")).toBeTruthy());
  });

  it("the + menu offers Chụp bill, not a dead button, and opens the bill screen", async () => {
    process.env.EXPO_PUBLIC_E2E = "1";
    try {
      await renderOverview();
      await fireEvent.press(screen.getByTestId("overview-add-button"));
      const bill = await screen.findByTestId("entry-menu-bill");
      expect(bill).not.toBeDisabled();
      await fireEvent.press(bill);
      await screen.findByTestId("screen-bill");
    } finally {
      delete process.env.EXPO_PUBLIC_E2E;
    }
  });

  it("group expense: the total includes my share and shows the group note", async () => {
    const db = global.__OVERVIEW_TEST_DB__ as unknown as AnyDb;
    const g = await createGroupRepository(db).createGroup({ name: "Đà Lạt", members: ["An", "Bình", "Chi"] });
    const ids = g.members.map((m) => m.id);
    await createGroupExpenseRepository(db).createGroupExpense({
      groupId: g.id,
      amount: 1_000_000,
      payerMemberId: ids[1],
      splitMode: "equal",
      shares: ids.map((memberId) => ({ memberId })),
      occurredAt: "2026-11-10T03:00:00Z",
    });
    await renderOverview();
    await waitFor(() => expect(text("overview-expense")).toBe("250.000đ"));
    expect(screen.getByTestId("overview-group-share")).toBeTruthy();
  });

  it("header: greeting is 13px muted above a 22px bold month title", async () => {
    await renderOverview();
    const month = await screen.findByText("Tháng 11/2026");
    const greeting = screen.getByText(/^Xin chào/);
    const g = StyleSheet.flatten(greeting.props.style);
    const m = StyleSheet.flatten(month.props.style);
    expect(g).toMatchObject({ fontSize: 13, color: colors.textMuted });
    expect(m).toMatchObject({ fontSize: 22, color: colors.text });
    expect(m.fontFamily).toMatch(/bold/i);
  });

  it("header: white bordered Đổi tháng button switches the month", async () => {
    await add(50_000, "2026-11-05T03:00:00Z");
    await add(70_000, "2026-10-05T03:00:00Z");
    await renderOverview();
    await waitFor(() => expect(text("overview-expense")).toBe("50.000đ"));
    const btn = screen.getByLabelText("Đổi tháng");
    expect(btn.props.testID).toBe("overview-month-button");
    expect(StyleSheet.flatten(btn.props.style)).toMatchObject({
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.surface,
      borderColor: colors.border,
    });
    await fireEvent.press(btn);
    await fireEvent.press(await screen.findByTestId("overview-pick-month-2026-10"));
    await waitFor(() => expect(text("overview-expense")).toBe("70.000đ"));
    expect(screen.getByText("Tháng 10/2026")).toBeTruthy();
  });

  it("add action is a 52px white floating button outside the header", async () => {
    await renderOverview();
    const fab = screen.getByTestId("overview-add-button");
    expect(StyleSheet.flatten(fab.props.style)).toMatchObject({
      position: "absolute",
      right: 20,
      bottom: 20,
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: colors.surface,
      borderColor: colors.border,
    });
    await fireEvent.press(fab);
    expect(await screen.findByTestId("entry-menu-manual")).toBeTruthy();
  });

  it("design: hero, tiles, cards and spacing match the CSS", async () => {
    await add(1_000_000, "2026-10-05T03:00:00Z");
    await add(1_250_000, "2026-11-05T03:00:00Z");
    await renderOverview();
    const flat = (el: { props: { style?: unknown } }) =>
      StyleSheet.flatten(el.props.style as never) as Record<string, unknown>;
    await screen.findByTestId("overview-banner");
    expect(flat(screen.getByTestId("overview-hero"))).toMatchObject({ gap: 14 });
    const amount = flat(screen.getByTestId("overview-expense"));
    expect(amount).toMatchObject({ fontSize: 32, letterSpacing: -0.5 });
    expect(amount.fontFamily).toMatch(/bold/i);
    const label = flat(screen.getByText("Đã chi tháng này"));
    expect(label).toMatchObject({ fontSize: 13, opacity: 0.85 });
    const income = screen.getByTestId("overview-income");
    expect(flat(income)).toMatchObject({ fontSize: 16 });
    expect(flat(income).fontFamily).toMatch(/semibold/i);
    const tile = flat(income.parent as never);
    expect(tile).toMatchObject({
      backgroundColor: overlays.button,
      borderRadius: 12,
      paddingVertical: 10,
      paddingHorizontal: 12,
      gap: 2,
    });
    expect(flat(screen.getByTestId("overview-banner"))).toMatchObject({
      borderRadius: 14,
      paddingVertical: 12,
      paddingHorizontal: 14,
      gap: 10,
    });
    const pct = screen.getByText("25%");
    expect(flat(pct).fontFamily).toMatch(/bold/i);
    expect(screen.getByText(/cao hơn tháng trước 25%/)).toBeTruthy();
  });

  it("design: card titles 15px, legend 2-column grid with compact amounts, recent rows with top dividers", async () => {
    await add(3_200_000, "2026-11-02T03:00:00Z", "expense", "Ăn uống");
    await add(1_800_000, "2026-11-03T03:00:00Z", "expense", "Mua sắm");
    await add(1_450_000, "2026-11-04T03:00:00Z", "expense", "Di chuyển");
    await add(950_000, "2026-11-05T03:00:00Z", "expense", "Lưu trú");
    await renderOverview();
    await screen.findByTestId("overview-top-0");
    const flat = (el: { props: { style?: unknown } }) =>
      StyleSheet.flatten(el.props.style as never) as Record<string, unknown>;
    for (const t of ["Top danh mục", "Giao dịch gần đây"]) {
      const s = flat(screen.getByText(t));
      expect(s.fontSize).toBe(15);
      expect(s.fontFamily).toMatch(/semibold/i);
    }
    expect(screen.getByTestId("overview-top-0")).toHaveTextContent(/3,2tr$/);
    expect(screen.getByTestId("overview-top-3")).toHaveTextContent(/0,95tr$/);
    expect(screen.getByTestId("overview-top-0").parent).toBe(screen.getByTestId("overview-top-1").parent);
    expect(screen.getByTestId("overview-top-0").parent).not.toBe(screen.getByTestId("overview-top-2").parent);
    expect(flat(screen.getByTestId("overview-top-0"))).toMatchObject({ gap: 8 });
    expect(flat(screen.getByTestId("overview-recent"))).toMatchObject({ paddingVertical: 8, paddingHorizontal: 16 });
    const row = flat(screen.getAllByTestId(/^txn-item-/)[0]);
    expect(row).toMatchObject({ borderTopWidth: 1, borderTopColor: "#EEF0F3" });
  });
});

describe("Tổng quan month picker sheet", () => {
  it("AC2: picking a month closes the sheet and reloads that month", async () => {
    await add(50_000, "2026-11-05T03:00:00Z");
    await add(70_000, "2026-10-05T03:00:00Z");
    await renderOverview();
    await waitFor(() => expect(text("overview-expense")).toBe("50.000đ"));
    await fireEvent.press(screen.getByTestId("overview-month-button"));
    expect(await screen.findByTestId("sheet-picker-layer")).toBeTruthy();
    await fireEvent.press(screen.getByTestId("overview-pick-month-2026-10"));
    await waitFor(() => expect(text("overview-expense")).toBe("70.000đ"));
    await waitFor(() => expect(screen.queryByTestId("sheet-picker-layer")).toBeNull());
    expect(screen.getByText("Tháng 10/2026")).toBeTruthy();
  });

  it("AC2: a backdrop press closes the sheet without reloading", async () => {
    await add(50_000, "2026-11-05T03:00:00Z");
    await renderOverview();
    await waitFor(() => expect(text("overview-expense")).toBe("50.000đ"));
    await fireEvent.press(screen.getByTestId("overview-month-button"));
    await screen.findByTestId("sheet-picker-layer");
    await fireEvent.press(screen.getByLabelText("Đóng"));
    await waitFor(() => expect(screen.queryByTestId("sheet-picker-layer")).toBeNull());
    expect(text("overview-expense")).toBe("50.000đ");
    expect(screen.getByText("Tháng 11/2026")).toBeTruthy();
  });

  it("AC2: Modal onRequestClose closes the sheet", async () => {
    await add(50_000, "2026-11-05T03:00:00Z");
    await renderOverview();
    await waitFor(() => expect(text("overview-expense")).toBe("50.000đ"));
    await fireEvent.press(screen.getByTestId("overview-month-button"));
    await screen.findByTestId("sheet-picker-layer");
    let modal = screen.getByTestId("sheet-picker-layer").parent;
    while (modal && !("onRequestClose" in modal.props)) modal = modal.parent;
    await act(async () => modal!.props.onRequestClose());
    await waitFor(() => expect(screen.queryByTestId("sheet-picker-layer")).toBeNull());
    expect(screen.getByText("Tháng 11/2026")).toBeTruthy();
  });
});
