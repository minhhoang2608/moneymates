import * as safeArea from "react-native-safe-area-context";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";

import { createGroupExpenseRepository, createGroupRepository, createTransactionRepository } from "@/db/repositories";
import type { AnyDb } from "@/db/seed";
import { openTestDb } from "@/db/testing/testDb";
import { catId } from "@/testing/repoTestUtils";

jest.mock("@expo-google-fonts/inter", () => ({ useFonts: () => [true, null] }));
jest.mock("@/db/DatabaseProvider", () => ({
  DatabaseProvider: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock("@/db/client", () => {
  const db = new Proxy({}, { get: (_t, key) => (global.__STATS_TEST_DB__ as never)[key] });
  return { db };
});

declare global {
  var __STATS_TEST_DB__: object;
}

let file: string;

beforeEach(() => {
  // Fake only Date: "now" is Sat 15/11/2025 12:00 VN.
  jest.useFakeTimers({
    now: new Date("2025-11-15T05:00:00Z"),
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
  file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "mm-stats-")), "test.db");
  global.__STATS_TEST_DB__ = openTestDb(file).db;
});
afterEach(() => jest.useRealTimers());

const repo = () => createTransactionRepository(global.__STATS_TEST_DB__ as unknown as AnyDb);

const add = (amount: number, occurred_at: string, type: "expense" | "income" = "expense", cat?: string) =>
  repo().create({
    type,
    amount,
    occurred_at,
    note: "",
    category_id: catId(cat ?? (type === "expense" ? "Ăn uống" : "Lương"), type),
  });

const text = (id: string) => screen.getByTestId(id).props.children;

async function renderStats() {
  await renderRouter("./app", { initialUrl: "/stats" });
  await screen.findByTestId("screen-stats");
}

async function seedGroupShare() {
  const db = global.__STATS_TEST_DB__ as unknown as AnyDb;
  const g = await createGroupRepository(db).createGroup({ name: "Đà Lạt", members: ["An", "Bình", "Chi"] });
  const ids = g.members.map((m) => m.id);
  await createGroupExpenseRepository(db).createGroupExpense({
    groupId: g.id,
    amount: 1_000_000,
    payerMemberId: ids[1],
    splitMode: "equal",
    shares: ids.map((memberId) => ({ memberId })),
    occurredAt: "2025-11-10T03:00:00Z",
    categoryId: catId("Ăn uống", "expense"),
  });
}

describe("Thống kê screen", () => {
  afterEach(() => jest.restoreAllMocks());

  it("keeps the header below the status bar", async () => {
    jest.spyOn(safeArea, "useSafeAreaInsets").mockReturnValue({ top: 30, bottom: 0, left: 0, right: 0 });
    await renderStats();
    expect(screen.getByTestId("screen-header")).toHaveStyle({ paddingTop: 30, height: 94 });
  });

  it("AC1: shows Nov expense total 500.000đ with Ăn uống first", async () => {
    await add(300_000, "2025-11-05T03:00:00Z");
    await add(200_000, "2025-11-06T03:00:00Z", "expense", "Di chuyển");
    await renderStats();
    await waitFor(() => expect(text("stats-total")).toBe("500.000đ"));
    expect(screen.getByTestId("stats-category-0")).toHaveTextContent(/Ăn uống/);
    expect(screen.getByTestId("stats-category-1")).toHaveTextContent(/Di chuyển/);
  });

  it("AC2: includes my group share", async () => {
    await add(300_000, "2025-11-05T03:00:00Z");
    await add(200_000, "2025-11-06T03:00:00Z", "expense", "Di chuyển");
    await seedGroupShare();
    await renderStats();
    await waitFor(() => expect(text("stats-total")).toBe("750.000đ"));
    expect(screen.getByTestId("stats-category-0")).toHaveTextContent(/550\.000đ/);
    expect(screen.getByText("Đã gồm phần của bạn trong các nhóm (250.000đ).")).toBeTruthy();
  });

  it("AC3: Thu switch shows Lương 25.000.000đ and hides the group note", async () => {
    await add(25_000_000, "2025-11-01T03:00:00Z", "income");
    await seedGroupShare();
    await renderStats();
    await screen.findByTestId("stats-group-share");
    await fireEvent.press(screen.getByTestId("stats-kind-income"));
    await waitFor(() => expect(screen.getByTestId("stats-category-0")).toHaveTextContent(/Lương.*25\.000\.000đ/));
    expect(screen.queryByTestId("stats-group-share")).toBeNull();
  });

  it("AC4: trend shows 6 bars T6..T11 with empty months at 0", async () => {
    await add(8_450_000, "2025-11-05T03:00:00Z");
    await renderStats();
    await screen.findByTestId("stats-trend-bar-5");
    expect(screen.getAllByTestId(/^stats-trend-bar-\d/)).toHaveLength(6);
    for (const l of ["T6", "T7", "T8", "T9", "T10", "T11"]) expect(screen.getByText(l)).toBeTruthy();
    expect(screen.getByText("8,45")).toBeTruthy();
    expect(screen.getAllByText("0")).toHaveLength(5);
  });

  it("AC5: picking Tháng 10 updates the breakdown", async () => {
    await add(300_000, "2025-11-05T03:00:00Z");
    await add(120_000, "2025-10-05T03:00:00Z", "expense", "Di chuyển");
    await renderStats();
    await waitFor(() => expect(text("stats-total")).toBe("300.000đ"));
    await fireEvent.press(screen.getByTestId("stats-month-button"));
    await fireEvent.press(await screen.findByTestId("stats-pick-month-2025-10"));
    await waitFor(() => expect(text("stats-total")).toBe("120.000đ"));
    expect(screen.getByTestId("stats-category-0")).toHaveTextContent(/Di chuyển/);
    expect(screen.getByText("Tháng 10 ▾")).toBeTruthy();
  });

  it("AC6: an empty month shows the empty state and no chart", async () => {
    await add(300_000, "2025-11-05T03:00:00Z");
    await renderStats();
    await waitFor(() => expect(text("stats-total")).toBe("300.000đ"));
    await fireEvent.press(screen.getByTestId("stats-month-button"));
    await fireEvent.press(await screen.findByTestId("stats-pick-month-2025-09"));
    await screen.findByTestId("stats-empty");
    expect(screen.queryByTestId("stats-trend")).toBeNull();
    expect(screen.queryByTestId("stats-total")).toBeNull();
  });
});
