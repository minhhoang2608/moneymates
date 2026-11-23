import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { fireEvent, renderRouter, screen } from "expo-router/testing-library";

import { createGroupExpenseRepository, createGroupRepository, createProfileRepository } from "@/db/repositories";
import type { AnyDb } from "@/db/seed";
import { openTestDb } from "@/db/testing/testDb";
import { catId } from "@/testing/repoTestUtils";

jest.mock("@expo-google-fonts/inter", () => ({ useFonts: () => [true, null] }));
jest.mock("@/db/DatabaseProvider", () => ({
  DatabaseProvider: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock("@/db/client", () => {
  const db = new Proxy({}, { get: (_t, key) => (global.__GFORM_TEST_DB__ as never)[key] });
  return { db };
});

declare global {
  var __GFORM_TEST_DB__: object;
}

let file: string;
beforeEach(() => {
  file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "mm-gform-")), "test.db");
  global.__GFORM_TEST_DB__ = openTestDb(file).db;
});

const d = () => openTestDb(file).db as unknown as AnyDb;

async function setup() {
  await createProfileRepository(d()).setDisplayName("Hoàng");
  const g = await createGroupRepository(d()).createGroup({ name: "Đà Lạt", members: ["An", "Bình"] });
  const [me, an, binh] = g.members.map((m) => m.id);
  await renderRouter("./app", { initialUrl: `/transaction/new?groupId=${g.id}` });
  await screen.findByTestId("payer-picker");
  return { g, me, an, binh };
}

async function pickCategory() {
  await fireEvent.press(screen.getByTestId("category-row"));
  await fireEvent.press(await screen.findByTestId(`category-item-${catId("Ăn uống")}`));
}

/** Polls the repo outside act() (async waitFor callbacks overlap act calls). */
async function until(check: () => Promise<boolean>) {
  for (let i = 0; i < 50; i++) {
    if (await check()) return;
    await new Promise((r) => setTimeout(r, 40));
  }
  throw new Error("condition not met");
}

const repo = () => createGroupExpenseRepository(d());
const sharesOf = async (groupId: string) => {
  const list = await repo().listGroupExpenses(groupId);
  expect(list).toHaveLength(1);
  return { row: list[0], shares: (await repo().getShares(list[0].id)).map((s) => s.amount) };
};
const disabled = () => screen.getByTestId("save-button").props.accessibilityState.disabled;

describe("group expense form", () => {
  it("AC1: equal split of 1.000.000 among 3", async () => {
    const { g } = await setup();
    await fireEvent.changeText(screen.getByTestId("amount-input"), "1000000");
    await pickCategory();
    await fireEvent.press(screen.getByTestId("save-button"));
    await until(async () => (await repo().groupTotal(g.id)) === 1_000_000);
    expect((await sharesOf(g.id)).shares).toEqual([333_334, 333_333, 333_333]);
  });

  it("AC2: unticked member excluded and chosen payer saved", async () => {
    const { g, an, binh } = await setup();
    await fireEvent.press(screen.getByTestId(`payer-${an}`));
    await fireEvent.press(screen.getByTestId(`member-tick-${binh}`));
    await fireEvent.changeText(screen.getByTestId("amount-input"), "300000");
    await pickCategory();
    await fireEvent.press(screen.getByTestId("save-button"));
    await until(async () => (await repo().groupTotal(g.id)) === 300_000);
    const { row, shares } = await sharesOf(g.id);
    expect(shares).toEqual([150_000, 150_000]);
    expect(row.paid_by_member_id).toBe(an);
  });

  it("AC3: by amount shows short/over and blocks save until it matches", async () => {
    const { g, me, an, binh } = await setup();
    await fireEvent.changeText(screen.getByTestId("amount-input"), "500000");
    await pickCategory();
    await fireEvent.press(screen.getByTestId(`member-tick-${binh}`));
    await fireEvent.press(screen.getByTestId("split-mode-amount"));
    await fireEvent.changeText(screen.getByTestId(`split-amount-${me}`), "200k");
    await fireEvent.changeText(screen.getByTestId(`split-amount-${an}`), "250k");
    expect(screen.getByTestId("split-status").props.children).toBe("Còn thiếu 50.000đ");
    expect(disabled()).toBe(true);
    await fireEvent.press(screen.getByTestId("save-button"));
    expect(await repo().listGroupExpenses(g.id)).toHaveLength(0);
    await fireEvent.changeText(screen.getByTestId(`split-amount-${an}`), "350k");
    expect(screen.getByTestId("split-status").props.children).toBe("Dư 50.000đ");
    await fireEvent.changeText(screen.getByTestId(`split-amount-${an}`), "300k");
    expect(disabled()).toBe(false);
    await fireEvent.press(screen.getByTestId("save-button"));
    await until(async () => (await repo().listGroupExpenses(g.id)).length === 1);
    expect((await sharesOf(g.id)).shares).toEqual([200_000, 300_000]);
  });

  it("AC4: by percent saves 50/30/20 and blocks 50/30/10", async () => {
    const { g, me, an, binh } = await setup();
    await fireEvent.changeText(screen.getByTestId("amount-input"), "100000");
    await pickCategory();
    await fireEvent.press(screen.getByTestId("split-mode-percent"));
    await fireEvent.changeText(screen.getByTestId(`split-percent-${me}`), "50");
    await fireEvent.changeText(screen.getByTestId(`split-percent-${an}`), "30");
    await fireEvent.changeText(screen.getByTestId(`split-percent-${binh}`), "10");
    expect(disabled()).toBe(true);
    expect(screen.getByTestId("split-status").props.children).toBe("Còn thiếu 10%");
    await fireEvent.changeText(screen.getByTestId(`split-percent-${binh}`), "20");
    expect(disabled()).toBe(false);
    await fireEvent.press(screen.getByTestId("save-button"));
    await until(async () => (await repo().listGroupExpenses(g.id)).length === 1);
    expect((await sharesOf(g.id)).shares).toEqual([50_000, 30_000, 20_000]);
  });

  it("AC5: Tôi is the default payer", async () => {
    const { me, an } = await setup();
    expect(screen.getByTestId(`payer-${me}`).props.accessibilityState.selected).toBe(true);
    await fireEvent.press(screen.getByTestId(`payer-${an}`));
    expect(screen.getByTestId(`payer-${an}`).props.accessibilityState.selected).toBe(true);
    expect(screen.getByTestId(`payer-${me}`).props.accessibilityState.selected).toBe(false);
  });

  it("flow path: payer chips for all members and the equal-split summary", async () => {
    const { g, me, an, binh } = await setup();
    for (const id of [me, an, binh]) expect(screen.getByTestId(`payer-${id}`)).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId("amount-input"), "1000000");
    expect(screen.getByTestId("split-summary").props.children).toBe("Chia đều · 3 người · 333.334đ mỗi người");
    await pickCategory();
    await fireEvent.press(screen.getByTestId("save-button"));
    await until(async () => (await repo().groupTotal(g.id)) === 1_000_000);
    const { shares } = await sharesOf(g.id);
    expect(shares).toHaveLength(3);
    expect(shares.reduce((a, b) => a + b, 0)).toBe(1_000_000);
  });
});
