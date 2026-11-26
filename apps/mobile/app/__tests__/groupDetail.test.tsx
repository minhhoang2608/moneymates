import * as safeArea from "react-native-safe-area-context";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { Alert } from "react-native";

import { fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";

import { createGroupExpenseRepository, createGroupRepository, createProfileRepository } from "@/db/repositories";
import type { AnyDb } from "@/db/seed";
import { openTestDb } from "@/db/testing/testDb";
import { vi } from "@/i18n/vi";

jest.mock("@expo-google-fonts/inter", () => ({ useFonts: () => [true, null] }));
jest.mock("@/db/DatabaseProvider", () => ({
  DatabaseProvider: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock("@/db/client", () => {
  const db = new Proxy({}, { get: (_t, key) => (global.__GDETAIL_TEST_DB__ as never)[key] });
  return { db };
});

declare global {
  var __GDETAIL_TEST_DB__: object;
}

let file: string;
beforeEach(() => {
  file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "mm-gdetail-")), "test.db");
  global.__GDETAIL_TEST_DB__ = openTestDb(file).db;
});
afterEach(() => jest.restoreAllMocks());

const d = () => openTestDb(file).db as unknown as AnyDb;
const groupsRepo = () => createGroupRepository(d());

async function setup() {
  await createProfileRepository(d()).setDisplayName("Hoàng");
  const g = await groupsRepo().createGroup({ name: "Đà Lạt", members: ["An"] });
  return { g, me: g.members[0].id, an: g.members[1].id };
}
async function open(id: string) {
  await renderRouter("./app", { initialUrl: `/group/${id}` });
  await screen.findByTestId("screen-group-detail");
}

describe("Chi tiết nhóm", () => {
  afterEach(() => jest.restoreAllMocks());

  it("keeps the header below the status bar", async () => {
    jest.spyOn(safeArea, "useSafeAreaInsets").mockReturnValue({ top: 30, bottom: 0, left: 0, right: 0 });
    const { g } = await setup();
    await open(g.id);
    expect(screen.getByTestId("screen-header")).toHaveStyle({ paddingTop: 30, height: 94 });
  });

  it("AC1: empty group shows 0đ, empty text, summary and add-expense", async () => {
    const { g } = await setup();
    await open(g.id);
    await waitFor(() => expect(screen.getByTestId("group-total").props.children).toBe("0đ"));
    expect(screen.getByText(vi.groupDetail.empty)).toBeTruthy();
    await fireEvent.press(screen.getByTestId("group-add-expense"));
    expect(screen).toHavePathname("/transaction/new");
    expect(screen).toHaveSearchParams({ groupId: g.id });
  });

  it("AC1: summary button navigates to /group/summary", async () => {
    const { g } = await setup();
    await open(g.id);
    await fireEvent.press(await screen.findByTestId("group-summary"));
    await screen.findByTestId("screen-group-summary");
    expect(screen).toHavePathname("/group/summary");
    expect(screen).toHaveSearchParams({ id: g.id });
  });

  it("edit navigates to /group/edit?id=", async () => {
    const { g } = await setup();
    await open(g.id);
    await fireEvent.press(await screen.findByTestId("group-edit"));
    await screen.findByTestId("screen-group-edit");
    expect(screen).toHavePathname("/group/edit");
    expect(screen).toHaveSearchParams({ id: g.id });
  });

  it("AC2: total and listed expenses", async () => {
    const { g, me, an } = await setup();
    const exp = createGroupExpenseRepository(d());
    await exp.createGroupExpense({
      groupId: g.id,
      amount: 150000,
      payerMemberId: me,
      splitMode: "equal",
      shares: [{ memberId: me }, { memberId: an }],
      occurredAt: "2026-11-20T08:00:00Z",
      note: "Khách sạn",
    });
    await exp.createGroupExpense({
      groupId: g.id,
      amount: 250000,
      payerMemberId: an,
      splitMode: "equal",
      shares: [{ memberId: me }, { memberId: an }],
      occurredAt: "2026-11-21T08:00:00Z",
      note: "Lẩu",
    });
    await open(g.id);
    await waitFor(() => expect(screen.getByTestId("group-total").props.children).toBe("400.000đ"));
    expect(screen.getByText("Khách sạn")).toBeTruthy();
    expect(screen.getByText("Lẩu")).toBeTruthy();
    expect(screen.getByText("Tôi trả · chia đều 2")).toBeTruthy();
    expect(screen.getByText("An trả · chia đều 2")).toBeTruthy();
    expect(screen.queryByText(vi.groupDetail.empty)).toBeNull();
  });

  it("AC3: delete asks to confirm; cancel keeps the group", async () => {
    const { g } = await setup();
    const spy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    await open(g.id);
    await fireEvent.press(await screen.findByTestId("group-delete"));
    expect(spy).toHaveBeenCalledWith(vi.groupDetail.deleteTitle, vi.groupDetail.deleteMessage, expect.any(Array));
    expect(await groupsRepo().listGroups()).toHaveLength(1);
  });

  it("AC3: confirming soft-deletes the group and returns to the list", async () => {
    const { g } = await setup();
    jest.spyOn(Alert, "alert").mockImplementation((_t, _m, buttons) => {
      buttons?.find((b) => b.style === "destructive")?.onPress?.();
    });
    await renderRouter("./app", { initialUrl: "/groups" });
    await fireEvent.press(await screen.findByTestId(`group-card-${g.id}`));
    await screen.findByTestId("screen-group-detail");
    await fireEvent.press(await screen.findByTestId("group-delete"));
    await screen.findByTestId("screen-groups");
    expect(await groupsRepo().listGroups()).toHaveLength(0);
    expect(await screen.findByText(vi.groups.empty)).toBeTruthy();
  });
});
