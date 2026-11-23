import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { fireEvent, renderRouter, screen } from "expo-router/testing-library";

import qr from "../../e2e/fixtures/qr.json";
import {
  createGroupExpenseRepository,
  createGroupRepository,
  createProfileRepository,
  createTransactionRepository,
} from "@/db/repositories";
import type { AnyDb } from "@/db/seed";
import { openTestDb } from "@/db/testing/testDb";
import { scanResultToRoute } from "@/lib/vietqr/scanRoute";
import { catId } from "@/testing/repoTestUtils";

jest.mock("@expo-google-fonts/inter", () => ({ useFonts: () => [true, null] }));
jest.mock("@/db/DatabaseProvider", () => ({
  DatabaseProvider: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock("@/db/client", () => {
  const db = new Proxy({}, { get: (_t, key) => (global.__TW_TEST_DB__ as never)[key] });
  return { db };
});
jest.mock("@/lib/payConfirm/handOffDeps", () => ({
  makeHandOff: jest.fn(() => async () => ({ opened: true })),
}));

declare global {
  var __TW_TEST_DB__: object;
}

let file: string;
beforeEach(() => {
  file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "mm-tw-")), "test.db");
  global.__TW_TEST_DB__ = openTestDb(file).db;
});
const d = () => openTestDb(file).db as unknown as AnyDb;

async function until(check: () => Promise<boolean>) {
  for (let i = 0; i < 50; i++) {
    if (await check()) return;
    await new Promise((r) => setTimeout(r, 40));
  }
  throw new Error("condition not met");
}

async function seedGroup(name: string, members: string[], withRecentExpense: boolean) {
  await createProfileRepository(d()).setDisplayName("Hoàng");
  const g = await createGroupRepository(d()).createGroup({ name, members });
  if (withRecentExpense) {
    await createGroupExpenseRepository(d()).createGroupExpense({
      groupId: g.id,
      amount: 90000,
      payerMemberId: g.members[0].id,
      splitMode: "equal",
      shares: g.members.map((m) => ({ memberId: m.id })),
      occurredAt: new Date().toISOString(),
    });
  }
  return g;
}

const payUrl = () => {
  const r = scanResultToRoute(qr.dynamic);
  if (!r.ok) throw new Error("expected ok");
  return `/pay-confirm?${new URLSearchParams(r.href.params).toString()}`;
};

describe("Ghi vào default wiring", () => {
  it("manual entry defaults to the group used within 24h", async () => {
    await seedGroup("Đà Lạt", ["An"], true);
    await renderRouter("./app", { initialUrl: "/transaction/new" });
    await screen.findByTestId("payer-picker");
    expect(screen.getByText("Đà Lạt ›")).toBeTruthy();
    expect(screen.queryByTestId("money-source-row")).toBeNull();
  });

  it("manual entry defaults to Cá nhân with no recent group", async () => {
    await seedGroup("Đà Lạt", ["An"], false);
    await renderRouter("./app", { initialUrl: "/transaction/new" });
    expect(await screen.findByText("Cá nhân ›")).toBeTruthy();
    expect(screen.queryByTestId("payer-picker")).toBeNull();
    expect(screen.getByTestId("money-source-row")).toBeTruthy();
  });

  it("opening from a group's detail screen wins over last-used", async () => {
    await seedGroup("Đà Lạt", ["An"], true);
    const lunch = await createGroupRepository(d()).createGroup({ name: "Ăn trưa văn phòng", members: ["Minh"] });
    await renderRouter("./app", { initialUrl: `/transaction/new?groupId=${lunch.id}` });
    await screen.findByTestId("payer-picker");
    expect(screen.getByText("Ăn trưa văn phòng ›")).toBeTruthy();
  });

  it("switching the target in the sheet toggles the group section and saves into the group", async () => {
    const g = await seedGroup("Đà Lạt", ["An"], false);
    await renderRouter("./app", { initialUrl: "/transaction/new" });
    await screen.findByText("Cá nhân ›");
    await fireEvent.press(screen.getByTestId("target-line"));
    await fireEvent.press(await screen.findByText("Đà Lạt"));
    await screen.findByTestId("payer-picker");
    expect(screen.queryByTestId("money-source-row")).toBeNull();
    await fireEvent.changeText(screen.getByTestId("amount-input"), "200000");
    await fireEvent.press(screen.getByTestId("category-row"));
    await fireEvent.press(await screen.findByTestId(`category-item-${catId("Ăn uống")}`));
    await fireEvent.press(screen.getByTestId("save-button"));
    await until(async () => (await createGroupExpenseRepository(d()).groupTotal(g.id)) === 200_000);
  });

  it("pay-confirm saves a QR payment into the default group split equally", async () => {
    const g = await seedGroup("Đà Lạt", ["An", "Bình", "Chi"], true);
    await renderRouter("./app", { initialUrl: payUrl() });
    expect(await screen.findByText("Đà Lạt ›")).toBeTruthy();
    expect(screen.getByText("Trong nhóm: người chi là Tôi, chia đều 4 người.")).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId("pay-amount"), "400000");
    await fireEvent.press(screen.getByTestId("pay-submit"));
    const repo = createGroupExpenseRepository(d());
    await until(async () => (await repo.listGroupExpenses(g.id)).length === 2);
    const row = (await repo.listGroupExpenses(g.id)).find((r) => r.source === "qr")!;
    expect(row.paid_by_member_id).toBe(g.members[0].id);
    expect(row.split_mode).toBe("equal");
    expect((await repo.getShares(row.id)).map((s) => s.amount)).toEqual([100_000, 100_000, 100_000, 100_000]);
  });

  it("pay-confirm keeps a personal transaction when the target is Cá nhân", async () => {
    await seedGroup("Đà Lạt", ["An"], false);
    await renderRouter("./app", { initialUrl: payUrl() });
    expect(await screen.findByText("Cá nhân ›")).toBeTruthy();
    expect(screen.queryByTestId("pay-group-hint")).toBeNull();
    await fireEvent.press(screen.getByTestId("pay-submit"));
    const tx = createTransactionRepository(d());
    await until(async () => (await tx.list()).length === 1);
  });
});
