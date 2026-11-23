import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";

import { createTransactionRepository } from "@/db/repositories";
import type { AnyDb } from "@/db/seed";
import { openTestDb } from "@/db/testing/testDb";
import { catId } from "@/testing/repoTestUtils";

jest.mock("@expo-google-fonts/inter", () => ({ useFonts: () => [true, null] }));
jest.mock("@/db/DatabaseProvider", () => ({
  DatabaseProvider: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock("@/db/client", () => {
  const db = new Proxy({}, { get: (_t, key) => (global.__HISTORY_TEST_DB__ as never)[key] });
  return { db };
});

declare global {
  var __HISTORY_TEST_DB__: object;
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
  file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "mm-history-")), "test.db");
  global.__HISTORY_TEST_DB__ = openTestDb(file).db;
});
afterEach(() => jest.useRealTimers());

const repo = () => createTransactionRepository(global.__HISTORY_TEST_DB__ as unknown as AnyDb);
const reopened = () => createTransactionRepository(openTestDb(file).db as unknown as AnyDb);

async function add(
  amount: number,
  occurred_at: string,
  extra: { note?: string; type?: "expense" | "income"; cat?: string; money_source?: string } = {},
) {
  const type = extra.type ?? "expense";
  return repo().create({
    type,
    amount,
    occurred_at,
    note: extra.note ?? "",
    money_source: extra.money_source,
    category_id: catId(extra.cat ?? (type === "expense" ? "Ăn uống" : "Lương"), type),
  });
}

async function renderHistory() {
  await renderRouter("./app", { initialUrl: "/history" });
  await screen.findByTestId("screen-history");
}

describe("Lịch sử screen", () => {
  it("AC1: renders 3 day headers newest first with signed amounts", async () => {
    await add(55_000, "2026-11-22T03:00:00Z", { note: "cà phê" });
    await add(25_000_000, "2026-11-21T03:00:00Z", { type: "income", note: "lương" });
    await add(30_000, "2026-11-20T03:00:00Z", { note: "xăng", cat: "Di chuyển" });
    await renderHistory();
    await screen.findByText("−55.000đ");
    expect(screen.getByText("+25.000.000đ")).toBeTruthy();
    const headers = screen.getAllByTestId(/^history-day-/).map((n) => n.props.testID);
    expect(headers).toEqual(["history-day-2026-11-22", "history-day-2026-11-21", "history-day-2026-11-20"]);
    expect(screen.getByText("Hôm nay, 22/11")).toBeTruthy();
    expect(screen.getByText("Hôm qua, 21/11")).toBeTruthy();
  });

  it("AC2: Tháng 11 + Ăn uống + Chi shows only the match; clearing shows all", async () => {
    await add(40_000, "2026-11-10T03:00:00Z", { note: "match" });
    await add(70_000, "2026-11-11T03:00:00Z", { note: "other cat", cat: "Di chuyển" });
    await add(5_000_000, "2026-11-12T03:00:00Z", { note: "income", type: "income" });
    await add(90_000, "2026-10-12T03:00:00Z", { note: "october" });
    await renderHistory();
    await screen.findByText("match");
    // default month = November: the October row is hidden already
    expect(screen.queryByText("october")).toBeNull();
    await fireEvent.press(screen.getByTestId("history-chip-category"));
    await fireEvent.press(await screen.findByTestId(`history-pick-category-${catId("Ăn uống")}`));
    await fireEvent.press(screen.getByTestId("history-chip-type")); // → Chi
    await waitFor(() => expect(screen.queryByText("other cat")).toBeNull());
    expect(screen.getByText("match")).toBeTruthy();
    expect(screen.queryByText("income")).toBeNull();
    await fireEvent.press(screen.getByTestId("history-clear-filters"));
    await screen.findByText("october");
    expect(screen.getByText("other cat")).toBeTruthy();
    expect(screen.getByText("income")).toBeTruthy();
    expect(screen.queryByTestId("history-clear-filters")).toBeNull();
  });

  it("AC3: search 'phở' (any case) keeps only phở bò", async () => {
    await add(55_000, "2026-11-22T03:00:00Z", { note: "phở bò" });
    await add(20_000, "2026-11-22T02:00:00Z", { note: "cà phê" });
    await renderHistory();
    await screen.findByText("cà phê");
    await fireEvent.changeText(screen.getByTestId("history-search"), "PHỞ");
    await waitFor(() => expect(screen.queryByText("cà phê")).toBeNull());
    expect(screen.getByText("phở bò")).toBeTruthy();
  });

  it("AC4: delete shows undo, undo restores the same row", async () => {
    const t = await add(55_000, "2026-11-22T03:00:00Z", { note: "phở bò" });
    await renderHistory();
    await screen.findByText("phở bò");
    await fireEvent.press(screen.getByTestId(`history-delete-${t.id}`));
    await waitFor(() => expect(screen.queryByText("phở bò")).toBeNull());
    await fireEvent.press(await screen.findByTestId("undo"));
    await screen.findByText("phở bò");
    expect(screen.getByText("−55.000đ")).toBeTruthy();
    const [back] = await repo().list();
    expect(back).toMatchObject({ id: t.id, amount: 55_000, note: "phở bò", category_id: t.category_id });
    expect(back.deleted_at).toBeNull();
  });

  it("AC4: without undo the row stays deleted after reopening the db", async () => {
    const t = await add(55_000, "2026-11-22T03:00:00Z", { note: "phở bò" });
    await renderHistory();
    await screen.findByText("phở bò");
    await fireEvent.press(screen.getByTestId(`history-delete-${t.id}`));
    await waitFor(() => expect(screen.queryByText("phở bò")).toBeNull());
    expect(await reopened().list()).toEqual([]);
  });

  it("AC5: empty db and no-match filters show empty states", async () => {
    await renderHistory();
    expect(await screen.findByText("Chưa có giao dịch nào")).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId("history-search"), "zzz");
    expect(await screen.findByText("Không có giao dịch phù hợp")).toBeTruthy();
  });
});
