import { Alert, Keyboard } from "react-native";
import { act, fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";
import { router } from "expo-router";
import * as safeArea from "react-native-safe-area-context";

import { createCategoryRepository, createTransactionRepository } from "@/db/repositories";
import type { AnyDb } from "@/db/seed";
import { openTestDb } from "@/db/testing/testDb";
import { catId } from "@/testing/repoTestUtils";

jest.mock("@expo-google-fonts/inter", () => ({ useFonts: () => [true, null] }));
jest.mock("@/db/DatabaseProvider", () => ({
  DatabaseProvider: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock("@/db/client", () => {
  const db = new Proxy({}, { get: (_t, key) => (global.__CAT_TEST_DB__ as never)[key] });
  return { db };
});

declare global {
  var __CAT_TEST_DB__: object;
}

let db: AnyDb;
const repo = () => createCategoryRepository(db);

beforeEach(() => {
  db = openTestDb().db as unknown as AnyDb;
  global.__CAT_TEST_DB__ = db;
});

async function open(url = "/categories") {
  const view = await renderRouter("./app", { initialUrl: url });
  await screen.findByTestId("screen-categories");
  return view;
}

async function addCustom(name: string) {
  await fireEvent.press(screen.getByTestId("category-add"));
  await fireEvent.changeText(await screen.findByTestId("category-name-input"), name);
  await fireEvent.press(screen.getByTestId("category-save"));
}

describe("Danh mục screen", () => {
  it("keeps the header below the status bar", async () => {
    jest.spyOn(safeArea, "useSafeAreaInsets").mockReturnValue({ top: 30, bottom: 0, left: 0, right: 0 });
    await open();
    expect(JSON.stringify(screen.toJSON())).toContain('"paddingTop":30,"height":94');
    jest.restoreAllMocks();
  });

  it("pressing the sheet title dismisses the keyboard and keeps the sheet open", async () => {
    const spy = jest.spyOn(Keyboard, "dismiss");
    await open();
    await fireEvent.press(screen.getByTestId("category-add"));
    await fireEvent.press(await screen.findByTestId("category-sheet-title"));
    expect(spy).toHaveBeenCalled();
    expect(screen.getByTestId("category-save")).toBeTruthy();
    spy.mockRestore();
  });

  it("AC1: shows 9 expense tiles and 3 income tiles", async () => {
    await open();
    await waitFor(() => expect(screen.getAllByTestId(/^category-tile-/)).toHaveLength(9));
    await fireEvent.press(screen.getByTestId("category-tab-income"));
    await waitFor(() => expect(screen.getAllByTestId(/^category-tile-/)).toHaveLength(3));
  });

  it("AC2: defaults can't be deleted; icon and colour can change", async () => {
    await open();
    await fireEvent.press(await screen.findByTestId(`category-tile-${catId("Ăn uống")}`));
    expect(await screen.findByTestId("category-sheet")).toBeTruthy();
    expect(screen.queryByTestId("category-delete")).toBeNull();
    expect(screen.queryByTestId(/^category-delete-/)).toBeNull();
    await fireEvent.changeText(screen.getByTestId("category-icon-input"), "AB");
    await fireEvent.press(screen.getByTestId("category-color-2"));
    await fireEvent.press(screen.getByTestId("category-save"));
    await waitFor(() => expect(screen.queryByTestId("category-sheet")).toBeNull());
    const row = (await repo().listByKind("expense")).find((c) => c.id === catId("Ăn uống"))!;
    expect(row).toMatchObject({ icon: "AB", color: "#5E3FA8", name: "Ăn uống" });
    expect(await screen.findByText("AB")).toBeTruthy();
  });

  it("AC3: a new category shows under Của bạn, in the form picker and after remount", async () => {
    const view = await open();
    await addCustom("Cà phê");
    expect(await screen.findByText("Cà phê")).toBeTruthy();
    expect((await repo().listByKind("expense")).map((c) => c.name)).toContain("Cà phê");
    await act(async () => view.unmount());

    await open();
    expect(await screen.findByText("Cà phê")).toBeTruthy();
  });

  it("AC3b: the transaction form picker lists the custom category", async () => {
    const cf = await repo().create({ name: "Cà phê", kind: "expense", icon: "CF", color: "#6B4423" });
    await renderRouter("./app", { initialUrl: "/" });
    await fireEvent.press(await screen.findByTestId("overview-add-button"));
    await fireEvent.press(await screen.findByTestId("entry-menu-manual"));
    await fireEvent.press(await screen.findByTestId("category-row"));
    expect(await screen.findByTestId(`category-item-${cf.id}`)).toBeTruthy();
  });

  it("AC4: deleting moves transactions to Khác and removes the category", async () => {
    const cf = await repo().create({ name: "Cà phê", kind: "expense", icon: "CF", color: "#6B4423" });
    const txns = createTransactionRepository(db);
    const t = await txns.create({
      type: "expense",
      amount: 30000,
      category_id: cf.id,
      occurred_at: new Date().toISOString(),
    } as never);
    await open();
    const alert = jest.spyOn(Alert, "alert").mockImplementation((_t, _m, buttons) => {
      buttons?.find((b) => b.style === "destructive")?.onPress?.();
    });
    await fireEvent.press(await screen.findByTestId(`category-delete-${cf.id}`));
    await waitFor(() => expect(screen.queryByTestId(`category-row-${cf.id}`)).toBeNull());
    alert.mockRestore();
    expect((await txns.list()).find((x) => x.id === t.id)!.category_id).toBe(catId("Khác"));
    await act(async () => router.navigate("/"));
    await screen.findByTestId("overview-add-button");
    expect((await screen.findAllByText(/Khác/)).length).toBeGreaterThan(0);
    expect((await repo().listByKind("expense")).map((c) => c.id)).not.toContain(cf.id);
  });

  it("AC5: renaming shows the new name where categories are resolved by id", async () => {
    const cf = await repo().create({ name: "Cà phê", kind: "expense", icon: "CF", color: "#6B4423" });
    await createTransactionRepository(db).create({
      type: "expense",
      amount: 30000,
      category_id: cf.id,
      occurred_at: new Date().toISOString(),
    } as never);
    await open();
    await fireEvent.press(await screen.findByTestId(`category-edit-${cf.id}`));
    await fireEvent.changeText(await screen.findByTestId("category-name-input"), "Cafe");
    await fireEvent.press(screen.getByTestId("category-save"));
    await waitFor(() => expect(screen.queryByTestId("category-sheet")).toBeNull());
    expect(await screen.findByText("Cafe")).toBeTruthy();

    await act(async () => router.navigate("/"));
    await screen.findByTestId("overview-add-button");
    expect((await screen.findAllByText(/Cafe/)).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Cà phê/)).toBeNull();
  });

  it("AC6: an empty name is rejected and nothing is written", async () => {
    await open();
    const before = (await repo().listByKind("expense")).length;
    await addCustom("   ");
    expect(await screen.findByTestId("category-name-error")).toBeTruthy();
    expect((await repo().listByKind("expense")).length).toBe(before);
  });
});
