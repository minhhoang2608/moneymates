import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { Alert } from "react-native";
import { fireEvent, renderRouter, screen, waitFor, act } from "expo-router/testing-library";

import {
  createMoneySourceRepository,
  createPaymentAppPrefsRepository,
  createPreferencesRepository,
  createTransactionRepository,
} from "@/db/repositories";
import type { AnyDb } from "@/db/seed";
import { openTestDb } from "@/db/testing/testDb";
import { catId } from "@/testing/repoTestUtils";

jest.mock("@expo-google-fonts/inter", () => ({ useFonts: () => [true, null] }));
jest.mock("@/db/DatabaseProvider", () => ({
  DatabaseProvider: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock("@/db/client", () => {
  const db = new Proxy({}, { get: (_t, key) => (global.__SET_TEST_DB__ as never)[key] });
  return { db };
});
jest.mock("expo-constants", () => ({
  __esModule: true,
  default: { expoConfig: { version: "9.9.9" } },
}));

declare global {
  var __SET_TEST_DB__: object;
}

let file: string;
const fresh = () => openTestDb(file).db as unknown as AnyDb;

afterEach(() => jest.restoreAllMocks());

beforeEach(() => {
  file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "mm-set-")), "test.db");
  global.__SET_TEST_DB__ = openTestDb(file).db;
});

async function open() {
  const view = await renderRouter("./app", { initialUrl: "/settings" });
  await screen.findByTestId("screen-settings", {}, { timeout: 5000 });
  await screen.findByTestId("settings-app-row-tpbank");
  return view;
}
const rowIds = () =>
  screen.getAllByTestId(/^settings-app-row-/).map((n) => n.props.testID.replace("settings-app-row-", ""));

describe("Cài đặt screen", () => {
  it("AC1: reorders payment apps with the up buttons and persists across remount", async () => {
    await createPaymentAppPrefsRepository(fresh()).setAppOrder(["tpbank", "tcb", "momo", "vcb", "mb"]);
    const view = await open();
    expect(rowIds()).toEqual(["tpbank", "tcb", "momo", "vcb", "mb", "icb", "bidv", "acb", "ocb"]);
    await fireEvent.press(screen.getByTestId("settings-app-up-momo"));
    await fireEvent.press(screen.getByTestId("settings-app-up-momo"));
    await waitFor(() => expect(rowIds()[0]).toBe("momo"));
    await waitFor(async () => expect((await createPaymentAppPrefsRepository(fresh()).getAppOrder())[0]).toBe("momo"));
    view.unmount();
    await open();
    expect(rowIds()[0]).toBe("momo");
  });

  it("AC1: dragging the handle moves the row", async () => {
    await createPaymentAppPrefsRepository(fresh()).setAppOrder(["tpbank", "tcb", "momo", "vcb", "mb"]);
    await open();
    const handle = screen.getByTestId("settings-app-handle-momo");
    // Drive the PanResponder through its handlers with a synthetic gesture.
    const mk = (y: number, active: boolean) => {
      const touch = {
        touchActive: active,
        startPageX: 0,
        startPageY: 0,
        startTimeStamp: 0,
        currentPageX: 0,
        currentPageY: y,
        currentTimeStamp: 1,
        previousPageX: 0,
        previousPageY: 0,
        previousTimeStamp: 0,
      };
      return {
        nativeEvent: {
          touches: active ? [{ pageX: 0, pageY: y }] : [],
          changedTouches: [{ pageX: 0, pageY: y }],
          pageX: 0,
          pageY: y,
          timestamp: 1,
        },
        touchHistory: {
          touchBank: [touch],
          numberActiveTouches: active ? 1 : 0,
          indexOfSingleActiveTouch: 0,
          mostRecentTimeStamp: 1,
        },
      };
    };
    await act(async () => {
      handle.props.onStartShouldSetResponder(mk(0, true));
      handle.props.onResponderGrant(mk(0, true));
      handle.props.onResponderMove(mk(-104, true));
      handle.props.onResponderRelease(mk(-104, false));
    });
    await waitFor(() => expect(rowIds()[0]).toBe("momo"));
  });

  it("AC2: adds a money source with a kind; empty name is rejected", async () => {
    await open();
    await fireEvent.press(screen.getByTestId("settings-sources-row"));
    await fireEvent.press(await screen.findByTestId("settings-source-add"));
    expect(await screen.findByTestId("settings-source-error")).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId("settings-source-name"), "Visa");
    await fireEvent.press(screen.getByTestId("settings-source-kind-card"));
    await fireEvent.press(screen.getByTestId("settings-source-add"));
    expect(await screen.findByText("Visa")).toBeTruthy();
    const rows = await createMoneySourceRepository(fresh()).listSources();
    const visa = rows.filter((r) => r.name === "Visa");
    expect(visa).toHaveLength(1);
    expect(visa[0].kind).toBe("card");
  });

  it("AC3: deleting a source keeps transactions untouched", async () => {
    const src = await createMoneySourceRepository(fresh()).addSource("Visa", "card");
    const tx = await createTransactionRepository(fresh()).create({
      type: "expense",
      amount: 50000,
      category_id: catId("Ăn uống"),
      occurred_at: "2026-01-02T03:00:00Z",
      money_source: "Visa",
    });
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    await open();
    await fireEvent.press(screen.getByTestId("settings-sources-row"));
    await fireEvent.press(await screen.findByTestId(`settings-source-delete-${src.id}`));
    expect(alert).toHaveBeenCalledTimes(1);
    const buttons = alert.mock.calls[0][2]!;
    expect(screen.getByTestId(`settings-source-${src.id}`)).toBeTruthy();
    await act(async () => {
      await buttons.find((b) => b.text === "Xóa")!.onPress!();
    });
    await waitFor(() => expect(screen.queryByTestId(`settings-source-${src.id}`)).toBeNull());
    const after = await createTransactionRepository(fresh()).getById(tx.id);
    expect(after!.money_source).toBe("Visa");
    expect(after!.updated_at).toBe(tx.updated_at);
    alert.mockRestore();
  });

  it("AC3: cancel keeps the source", async () => {
    const src = await createMoneySourceRepository(fresh()).addSource("Visa", "card");
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    await open();
    await fireEvent.press(screen.getByTestId("settings-sources-row"));
    await fireEvent.press(await screen.findByTestId(`settings-source-delete-${src.id}`));
    expect(alert.mock.calls[0][2]!.find((b) => b.text === "Hủy")).toBeTruthy();
    expect(screen.getByTestId(`settings-source-${src.id}`)).toBeTruthy();
    alert.mockRestore();
  });

  it("AC6: footer shows the app version", async () => {
    await open();
    expect(screen.getByTestId("settings-footer").props.children).toBe("Dữ liệu chỉ lưu trên máy này · Phiên bản 9.9.9");
  });

  it("AC4: default currency is a read-only VND row", async () => {
    await open();
    const row = screen.getByTestId("settings-currency");
    expect(screen.getByText("VND")).toBeTruthy();
    expect(row.props.onPress).toBeUndefined();
    expect(row.props.accessibilityRole).not.toBe("button");
    await fireEvent.press(row);
    expect(await createPreferencesRepository(fresh()).getDefaultCurrency()).toBe("VND");
  });

  it("AC5: the alert toggle persists", async () => {
    const view = await open();
    await waitFor(() => expect(screen.getByTestId("settings-alert-toggle").props.value).toBe(true));
    await fireEvent(screen.getByTestId("settings-alert-toggle"), "valueChange", false);
    await waitFor(async () => expect(await createPreferencesRepository(fresh()).getAlertOverLastMonth()).toBe(false));
    view.unmount();
    await open();
    await waitFor(() => expect(screen.getByTestId("settings-alert-toggle").props.value).toBe(false));
  });
});
