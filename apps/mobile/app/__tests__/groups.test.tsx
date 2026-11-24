import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { eq } from "drizzle-orm";
import { act } from "react";
import { Keyboard } from "react-native";
import { fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";

import {
  createBankAccountRepository,
  createGroupRepository,
  createProfileRepository,
  createTransactionRepository,
} from "@/db/repositories";
import { transactions } from "@/db/schema";
import type { AnyDb } from "@/db/seed";
import { openTestDb } from "@/db/testing/testDb";
import { vi } from "@/i18n/vi";
import { DEFAULT_CATEGORIES } from "@/lib/category/defaults";
import { setHapticsEnabled } from "@/lib/haptics";

jest.mock("@expo-google-fonts/inter", () => ({ useFonts: () => [true, null] }));
jest.mock("@/db/DatabaseProvider", () => ({
  DatabaseProvider: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock("@/db/client", () => {
  const db = new Proxy({}, { get: (_t, key) => (global.__GROUP_TEST_DB__ as never)[key] });
  return { db };
});

declare global {
  var __GROUP_TEST_DB__: object;
}

let file: string;
function freshFile() {
  file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "mm-group-")), "test.db");
  global.__GROUP_TEST_DB__ = openTestDb(file).db;
}
const d = () => openTestDb(file).db as unknown as AnyDb;
const groupsRepo = () => createGroupRepository(d());
const account = (no: string, bin = "970407") => ({ bank_bin: bin, account_no: no, account_name: "HOANG LE" });

async function renderList() {
  await renderRouter("./app", { initialUrl: "/groups" });
  await screen.findByTestId("screen-groups");
}
async function renderEdit(id?: string) {
  await renderRouter("./app", { initialUrl: id ? `/group/edit?id=${id}` : "/group/edit" });
  await screen.findByTestId("screen-group-edit");
}
async function addMembers(...names: string[]) {
  for (const n of names) {
    await fireEvent.changeText(screen.getByTestId("member-add-input"), n);
    await fireEvent.press(screen.getByTestId("member-add"));
  }
}

describe("Nhóm list", () => {
  it("AC1: lists group with 0đ and members Hoàng (Tôi), An, Bình", async () => {
    freshFile();
    await createProfileRepository(d()).setDisplayName("Hoàng");
    const g = await groupsRepo().createGroup({
      name: "Đà Lạt",
      icon: "mountain",
      start_date: "2026-12-01",
      end_date: "2026-12-04",
      members: ["An", "Bình"],
    });
    await renderList();
    const card = await screen.findByTestId(`group-card-${g.id}`);
    expect(card.props.accessibilityLabel).toBe("Đà Lạt, Hoàng (Tôi), An, Bình");
    expect(screen.getByText("Đà Lạt")).toBeTruthy();
    expect(screen.getByText("0đ")).toBeTruthy();
    expect(screen.getByText("3 thành viên · 01–04/12")).toBeTruthy();
  });

  it("AC4: tapping a group card opens /group/<id>", async () => {
    freshFile();
    const g = await groupsRepo().createGroup({ name: "Đà Lạt", members: ["An"] });
    await renderList();
    await fireEvent.press(await screen.findByTestId(`group-card-${g.id}`));
    await screen.findByTestId("screen-group-detail");
    expect(screen).toHavePathname(`/group/${g.id}`);
  });

  it("AC6: no groups shows empty state; create navigates to /group/edit", async () => {
    freshFile();
    await renderList();
    expect(await screen.findByText(vi.groups.empty)).toBeTruthy();
    await fireEvent.press(screen.getByTestId("group-empty-create"));
    await screen.findByTestId("screen-group-edit");
    expect(screen).toHavePathname("/group/edit");
  });

  it("AC3: after profile rename to Minh, the list shows Minh", async () => {
    freshFile();
    await createProfileRepository(d()).setDisplayName("Hoàng");
    const g = await groupsRepo().createGroup({ name: "Đà Lạt", members: ["An"] });
    await createProfileRepository(d()).setDisplayName("Minh");
    await renderList();
    const card = await screen.findByTestId(`group-card-${g.id}`);
    expect(card.props.accessibilityLabel).toContain("Minh (Tôi)");
  });
});

describe("Tạo/sửa nhóm", () => {
  it("AC1: creates Đà Lạt with icon, members and saves", async () => {
    freshFile();
    await renderEdit();
    await fireEvent.changeText(screen.getByTestId("group-name"), "Đà Lạt");
    await fireEvent.press(screen.getByTestId("group-icon-sea"));
    await addMembers("An", "Bình");
    await fireEvent.press(screen.getByTestId("group-save"));
    await waitFor(async () => expect(await groupsRepo().listGroups()).toHaveLength(1));
    const [g] = await groupsRepo().listGroups();
    expect(g).toMatchObject({ name: "Đà Lạt", icon: "sea", total: 0 });
    expect(g.members.map((m) => m.displayName)).toEqual(["", "An", "Bình"]);
  });

  it("adds a member by submitting from the keyboard", async () => {
    freshFile();
    await renderEdit();
    await fireEvent.changeText(screen.getByTestId("group-name"), "Đà Lạt");
    const input = screen.getByTestId("member-add-input");
    await fireEvent.changeText(input, "An");
    await fireEvent(input, "submitEditing");
    expect(await screen.findByText("An")).toBeTruthy();
    expect(screen.getByTestId("member-add-input").props.value).toBe("");
    expect(screen.getByTestId("member-add-input").props.submitBehavior).toBe("blurAndSubmit");
    expect(screen.getByText(`${vi.groups.members} (2)`)).toBeTruthy();
    await fireEvent.press(screen.getByTestId("group-save"));
    await waitFor(async () => expect(await groupsRepo().listGroups()).toHaveLength(1));
    const [g] = await groupsRepo().listGroups();
    expect(g.members.map((m) => m.displayName)).toEqual(["", "An"]);
  });

  it("submitting the name field blurs it without saving or leaving", async () => {
    freshFile();
    await renderEdit();
    const name = screen.getByTestId("group-name");
    expect(name.props.submitBehavior).toBe("blurAndSubmit");
    await fireEvent.changeText(name, "Đà Lạt");
    await fireEvent(name, "submitEditing", { nativeEvent: { text: "Đà Lạt" } });
    expect(screen.getByTestId("screen-group-edit")).toBeTruthy();
    expect(await groupsRepo().listGroups()).toHaveLength(0);
  });

  it("submitEditing uses the event text even when state is stale", async () => {
    freshFile();
    await renderEdit();
    const input = screen.getByTestId("member-add-input");
    await fireEvent(input, "submitEditing", { nativeEvent: { text: "An" } });
    expect(screen.getByTestId("member-name-1")).toHaveTextContent("An");
    expect(screen.getByTestId("member-count")).toHaveTextContent(`${vi.groups.members} (2)`);
    expect(screen.getByTestId("member-add-input").props.value).toBe("");
  });

  it("pressing the title dismisses the keyboard and stays on the screen", async () => {
    freshFile();
    const spy = jest.spyOn(Keyboard, "dismiss");
    await renderEdit();
    await fireEvent.press(screen.getByTestId("group-edit-title"));
    expect(spy).toHaveBeenCalled();
    expect(screen.getByTestId("screen-group-edit")).toBeTruthy();
    spy.mockRestore();
  });

  it("submitting twice adds An then Bình", async () => {
    freshFile();
    await renderEdit();
    await fireEvent.changeText(screen.getByTestId("group-name"), "Đà Lạt");
    const input = screen.getByTestId("member-add-input");
    await fireEvent(input, "submitEditing", { nativeEvent: { text: "An" } });
    await fireEvent(input, "submitEditing", { nativeEvent: { text: "Bình" } });
    expect(screen.getByTestId("member-name-2")).toHaveTextContent("Bình");
    expect(screen.getByTestId("member-count")).toHaveTextContent(`${vi.groups.members} (3)`);
    await fireEvent.press(screen.getByTestId("group-save"));
    await waitFor(async () => expect(await groupsRepo().listGroups()).toHaveLength(1));
    const [g] = await groupsRepo().listGroups();
    expect(g.members.map((m) => m.displayName)).toEqual(["", "An", "Bình"]);
  });

  it("whitespace event text adds nothing", async () => {
    freshFile();
    await renderEdit();
    const input = screen.getByTestId("member-add-input");
    await fireEvent(input, "submitEditing", { nativeEvent: { text: "   " } });
    expect(screen.getByText(`${vi.groups.members} (1)`)).toBeTruthy();
  });

  it("shows added members by testID and updates the count", async () => {
    freshFile();
    await renderEdit();
    await addMembers("An", "Bình");
    expect(screen.getByTestId("member-name-1")).toHaveTextContent("An");
    expect(screen.getByTestId("member-name-2")).toHaveTextContent("Bình");
    expect(screen.getByTestId("member-count")).toHaveTextContent(`${vi.groups.members} (3)`);
    expect(screen.getByTestId("member-add-input").props.value).toBe("");
  });

  it("blank submit adds nothing", async () => {
    freshFile();
    await renderEdit();
    const input = screen.getByTestId("member-add-input");
    await fireEvent.changeText(input, "   ");
    await fireEvent(input, "submitEditing");
    expect(screen.getByText(`${vi.groups.members} (1)`)).toBeTruthy();
  });

  it("footer hides while the keyboard is open", async () => {
    freshFile();
    const handlers: Record<string, () => void> = {};
    const spy = jest.spyOn(Keyboard, "addListener").mockImplementation(((event: string, cb: () => void) => {
      handlers[event] = cb;
      return { remove: jest.fn() };
    }) as never);
    await renderEdit();
    expect(screen.getByTestId("group-save")).toBeTruthy();
    await act(async () => {
      handlers.keyboardDidShow();
    });
    expect(screen.queryByTestId("group-save")).toBeNull();
    await act(async () => {
      handlers.keyboardDidHide();
    });
    expect(screen.getByTestId("group-save")).toBeTruthy();
    spy.mockRestore();
  });

  it("AC2: preselects the default account and switching saves receiving_account_id", async () => {
    freshFile();
    const accounts = createBankAccountRepository(d());
    const first = await accounts.addAccount(account("190345676789"));
    const second = await accounts.addAccount(account("0456789123", "970423"));
    await accounts.setDefault(first.id);
    await renderEdit();
    await waitFor(() => expect(screen.getByTestId("group-account").props.children).toContain("6789"));
    await fireEvent.press(screen.getByTestId("group-account-change"));
    await fireEvent.press(await screen.findByTestId(`group-account-option-${second.id}`));
    await fireEvent.changeText(screen.getByTestId("group-name"), "Nhóm");
    await fireEvent.press(screen.getByTestId("group-save"));
    await waitFor(async () => expect(await groupsRepo().listGroups()).toHaveLength(1));
    expect((await groupsRepo().listGroups())[0].receiving_account_id).toBe(second.id);
  });

  it("AC2: new group uses the default account", async () => {
    freshFile();
    const accounts = createBankAccountRepository(d());
    const first = await accounts.addAccount(account("190345676789"));
    await renderEdit();
    await waitFor(() => expect(screen.getByTestId("group-account").props.children).toContain("6789"));
    await fireEvent.changeText(screen.getByTestId("group-name"), "Nhóm");
    await fireEvent.press(screen.getByTestId("group-save"));
    await waitFor(async () => expect(await groupsRepo().listGroups()).toHaveLength(1));
    expect((await groupsRepo().listGroups())[0].receiving_account_id).toBe(first.id);
  });

  it("AC3: Tôi row has no rename/remove; edit screen shows the live profile name", async () => {
    freshFile();
    await createProfileRepository(d()).setDisplayName("Hoàng");
    const g = await groupsRepo().createGroup({ name: "Đà Lạt", members: ["An"] });
    await createProfileRepository(d()).setDisplayName("Minh");
    await renderEdit(g.id);
    expect(await screen.findByText("(Minh)")).toBeTruthy();
    expect(screen.queryByTestId("member-rename-0")).toBeNull();
    expect(screen.queryByTestId("member-remove-0")).toBeNull();
    expect(screen.getByText(vi.groups.collector)).toBeTruthy();
  });

  it("AC4: member without transactions can be removed", async () => {
    freshFile();
    const g = await groupsRepo().createGroup({ name: "Đà Lạt", members: ["An", "Bình"] });
    await renderEdit(g.id);
    await fireEvent.press(await screen.findByTestId("member-remove-1"));
    await fireEvent.press(screen.getByTestId("group-save"));
    await waitFor(async () => expect((await groupsRepo().getGroup(g.id)).members).toHaveLength(2));
    expect((await groupsRepo().getGroup(g.id)).members.map((m) => m.displayName)).toEqual(["", "Bình"]);
  });

  it("AC4: member with a transaction has no remove action but can be renamed", async () => {
    freshFile();
    const g = await groupsRepo().createGroup({ name: "Đà Lạt", members: ["Bình"] });
    const binh = g.members[1];
    const sqlite = openTestDb(file);
    const row = await createTransactionRepository(sqlite.db).create({
      type: "expense",
      amount: 50000,
      category_id: DEFAULT_CATEGORIES[0].id,
      occurred_at: "2026-12-02T05:00:00Z",
    });
    sqlite.db
      .update(transactions)
      .set({ group_id: g.id, paid_by_member_id: binh.id })
      .where(eq(transactions.id, row.id))
      .run();
    await renderEdit(g.id);
    await screen.findByTestId("member-rename-1");
    expect(screen.queryByTestId("member-remove-1")).toBeNull();
    await fireEvent.press(screen.getByTestId("member-rename-1"));
    await fireEvent.changeText(screen.getByTestId("member-rename-input-1"), "Bình Lê");
    await fireEvent.press(screen.getByTestId("member-rename-save-1"));
    await fireEvent.press(screen.getByTestId("group-save"));
    await waitFor(async () =>
      expect((await groupsRepo().getGroup(g.id)).members.map((m) => m.displayName)).toContain("Bình Lê"),
    );
  });

  it("AC5: whitespace name shows an error and creates no group", async () => {
    freshFile();
    await renderEdit();
    await fireEvent.changeText(screen.getByTestId("group-name"), "   ");
    await fireEvent.press(screen.getByTestId("group-save"));
    expect((await screen.findByTestId("group-error")).props.children).toBe(vi.groups.errors.name_required);
    expect(await groupsRepo().listGroups()).toHaveLength(0);
  });
});

describe("Tạo/sửa nhóm: dates and validation", () => {
  async function pickDate(testId: string, date: Date) {
    await fireEvent.press(screen.getByTestId(testId));
    const picker = await screen.findByTestId("datetime-picker");
    await fireEvent(picker, "onChange", { type: "set" }, date);
  }

  it("AC1: picks start and end dates, stores YYYY-MM-DD; clear resets to null", async () => {
    freshFile();
    await renderEdit();
    await fireEvent.changeText(screen.getByTestId("group-name"), "Đà Lạt");
    await pickDate("group-start-date", new Date(2026, 11, 1, 9));
    await pickDate("group-end-date", new Date(2026, 11, 4, 9));
    expect(screen.queryByTestId("datetime-picker")).toBeNull();
    expect(screen.getByText("01/12/2026")).toBeTruthy();
    expect(screen.getByText("04/12/2026")).toBeTruthy();
    await fireEvent.press(screen.getByTestId("group-save"));
    await waitFor(async () => expect(await groupsRepo().listGroups()).toHaveLength(1));
    expect(await groupsRepo().listGroups()).toEqual([
      expect.objectContaining({ start_date: "2026-12-01", end_date: "2026-12-04" }),
    ]);
  });

  it("AC1: clear button resets a date to null", async () => {
    freshFile();
    await renderEdit();
    await fireEvent.changeText(screen.getByTestId("group-name"), "Đà Lạt");
    await pickDate("group-start-date", new Date(2026, 11, 1, 9));
    await fireEvent.press(screen.getByTestId("group-start-date-clear"));
    expect(screen.queryByTestId("group-start-date-clear")).toBeNull();
    await fireEvent.press(screen.getByTestId("group-save"));
    await waitFor(async () => expect(await groupsRepo().listGroups()).toHaveLength(1));
    expect((await groupsRepo().listGroups())[0].start_date).toBeNull();
  });

  it("end before start shows group-error and writes nothing", async () => {
    freshFile();
    const g = await groupsRepo().createGroup({ name: "Cũ", members: ["An"] });
    await renderEdit(g.id);
    await screen.findByTestId("member-rename-1");
    await fireEvent.changeText(screen.getByTestId("group-name"), "Mới");
    await pickDate("group-start-date", new Date(2026, 11, 10, 9));
    await pickDate("group-end-date", new Date(2026, 11, 4, 9));
    await fireEvent.press(screen.getByTestId("group-save"));
    expect((await screen.findByTestId("group-error")).props.children).toBe(vi.groups.errors.invalid_dates);
    expect((await groupsRepo().getGroup(g.id)).name).toBe("Cũ");
  });

  it("blank member rename shows group-error and leaves the stored group unchanged", async () => {
    freshFile();
    const g = await groupsRepo().createGroup({ name: "Cũ", members: ["An"] });
    await renderEdit(g.id);
    await fireEvent.changeText(await screen.findByTestId("group-name"), "Mới");
    await fireEvent.press(await screen.findByTestId("member-rename-1"));
    await fireEvent.changeText(screen.getByTestId("member-rename-input-1"), "  ");
    await fireEvent.press(screen.getByTestId("group-save"));
    expect((await screen.findByTestId("group-error")).props.children).toBe(vi.groups.errors.member_name_required);
    const stored = await groupsRepo().getGroup(g.id);
    expect(stored.name).toBe("Cũ");
    expect(stored.members.map((m) => m.displayName)).toEqual(["", "An"]);
  });
});

describe("Tạo/sửa nhóm: haptics", () => {
  const Haptics = jest.requireMock("expo-haptics");
  beforeEach(() => {
    jest.clearAllMocks();
    setHapticsEnabled(true);
  });
  afterEach(() => setHapticsEnabled(true));

  async function pickDate(testId: string, date: Date) {
    await fireEvent.press(screen.getByTestId(testId));
    await fireEvent(await screen.findByTestId("datetime-picker"), "onChange", { type: "set" }, date);
  }

  it("AC3: an empty name fires one error haptic and shows the message", async () => {
    freshFile();
    await renderEdit();
    await fireEvent.press(screen.getByTestId("group-save"));
    expect((await screen.findByTestId("group-error")).props.children).toBe(vi.groups.errors.name_required);
    expect(Haptics.notificationAsync).toHaveBeenCalledTimes(1);
    expect(Haptics.notificationAsync).toHaveBeenCalledWith("error");
    expect(Haptics.impactAsync).not.toHaveBeenCalled();
  });

  it("AC3: an empty member name fires one error haptic and shows the message", async () => {
    freshFile();
    const g = await groupsRepo().createGroup({ name: "Cũ", members: ["An"] });
    await renderEdit(g.id);
    await fireEvent.press(await screen.findByTestId("member-rename-1"));
    await fireEvent.changeText(screen.getByTestId("member-rename-input-1"), "  ");
    await fireEvent.press(screen.getByTestId("group-save"));
    expect((await screen.findByTestId("group-error")).props.children).toBe(vi.groups.errors.member_name_required);
    expect(Haptics.notificationAsync).toHaveBeenCalledTimes(1);
    expect(Haptics.impactAsync).not.toHaveBeenCalled();
  });

  it("AC3: invalid dates fire one error haptic and show the message", async () => {
    freshFile();
    await renderEdit();
    await fireEvent.changeText(screen.getByTestId("group-name"), "Đà Lạt");
    await pickDate("group-start-date", new Date(2026, 11, 10, 9));
    await pickDate("group-end-date", new Date(2026, 11, 4, 9));
    await fireEvent.press(screen.getByTestId("group-save"));
    expect((await screen.findByTestId("group-error")).props.children).toBe(vi.groups.errors.invalid_dates);
    expect(Haptics.notificationAsync).toHaveBeenCalledTimes(1);
    expect(Haptics.impactAsync).not.toHaveBeenCalled();
  });

  it("AC1: a valid save fires one light haptic and no error haptic", async () => {
    freshFile();
    await renderEdit();
    await fireEvent.changeText(screen.getByTestId("group-name"), "Đà Lạt");
    await fireEvent.press(screen.getByTestId("group-save"));
    await waitFor(async () => expect(await groupsRepo().listGroups()).toHaveLength(1));
    expect(Haptics.impactAsync).toHaveBeenCalledTimes(1);
    expect(Haptics.impactAsync).toHaveBeenCalledWith("light");
    expect(Haptics.notificationAsync).not.toHaveBeenCalled();
  });

  it("AC4: disabled haptics stay silent and behaviour is unchanged", async () => {
    setHapticsEnabled(false);
    freshFile();
    await renderEdit();
    await fireEvent.press(screen.getByTestId("group-save"));
    expect((await screen.findByTestId("group-error")).props.children).toBe(vi.groups.errors.name_required);
    await fireEvent.changeText(screen.getByTestId("group-name"), "Đà Lạt");
    await fireEvent.press(screen.getByTestId("group-save"));
    await waitFor(async () => expect(await groupsRepo().listGroups()).toHaveLength(1));
    expect(Haptics.impactAsync).not.toHaveBeenCalled();
    expect(Haptics.notificationAsync).not.toHaveBeenCalled();
  });
});
