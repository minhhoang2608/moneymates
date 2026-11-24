import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { StyleSheet } from "react-native";
import { fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";

import {
  createGroupExpenseRepository,
  createGroupRepository,
  createPreferencesRepository,
  createTransactionRepository,
} from "@/db/repositories";
import type { AnyDb } from "@/db/seed";
import { openTestDb } from "@/db/testing/testDb";
import { catId } from "@/testing/repoTestUtils";
import { colors } from "@/theme";

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
});
