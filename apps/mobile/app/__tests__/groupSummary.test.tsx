import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { Alert } from "react-native";

import { fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";

import { createGroupExpenseRepository, createGroupRepository, createProfileRepository } from "@/db/repositories";
import type { AnyDb } from "@/db/seed";
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
afterEach(() => jest.restoreAllMocks());

const d = () => openTestDb(file).db as unknown as AnyDb;

async function setup(names = ["An", "Bình"]) {
  await createProfileRepository(d()).setDisplayName("Hoàng");
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
    expect(screen.getByText("−400.000đ")).toBeTruthy();
    expect(screen.getByText("−100.000đ")).toBeTruthy();
    expect(screen.getByText("900.000đ")).toBeTruthy();
    expect(screen.getAllByText("400.000đ").length).toBeGreaterThanOrEqual(3);
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
    await fireEvent.press(screen.getByTestId(`mark-paid-${an}`));
    await waitFor(() => expect(screen.queryByTestId(`settle-item-${an}`)).toBeNull());
    expect(screen.getByTestId(`settle-item-${binh}`)).toBeTruthy();
    expect(screen.getByTestId("summary-subtitle").props.children).toBe("Đà Lạt · 900.000đ");
    expect(text("summary-remaining")).toBe("300.000đ");
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
    await open(g.id);
    await fireEvent.press(await screen.findByTestId(`summary-row-${binh}`));
    await screen.findByTestId("member-expenses-sheet");
    expect(screen.getAllByText("Khách sạn").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Lẩu").length).toBeGreaterThan(0);
    await fireEvent.press(screen.getByTestId("member-expenses-close"));
  });

  it("AC6: works offline without fetch; QR buttons show the placeholder", async () => {
    const fetchSpy = jest.fn();
    (global as { fetch?: unknown }).fetch = fetchSpy;
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    const { g, me, an, binh } = await setup();
    await expense(g.id, me, 900000, [me, an, binh], "Khách sạn");
    await open(g.id);
    await fireEvent.press(await screen.findByTestId(`qr-${an}`));
    await fireEvent.press(screen.getByTestId("qr-group"));
    expect(alertSpy).toHaveBeenCalledTimes(2);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("unknown group shows not-found", async () => {
    await setup();
    await open("missing");
    expect(await screen.findByTestId("group-not-found")).toBeTruthy();
  });
});
