import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import * as Linking from "expo-linking";
import { act, fireEvent, renderRouter, screen, waitFor, within } from "expo-router/testing-library";

import { createPaymentAppPrefsRepository } from "@/db/repositories";
import type { AnyDb } from "@/db/seed";
import { openTestDb } from "@/db/testing/testDb";

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

afterEach(() => jest.restoreAllMocks());

let file: string;
const fresh = () => openTestDb(file).db as unknown as AnyDb;
const repo = () => createPaymentAppPrefsRepository(fresh());

beforeEach(async () => {
  jest.spyOn(Linking, "canOpenURL").mockResolvedValue(false);
  file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "mm-pay-")), "test.db");
  global.__SET_TEST_DB__ = openTestDb(file).db;
  await repo().setEnabledOrder(["mb", "tpb", "tcb", "momo"]);
});

async function open(url = "/payment-apps") {
  const view = await renderRouter("./app", { initialUrl: url });
  await screen.findByTestId("screen-payment-apps", {}, { timeout: 5000 });
  await screen.findByTestId("payment-apps-enabled-heading");
  return view;
}
const enabledIds = () =>
  screen.getAllByTestId(/^payment-app-drag-/).map((n) => n.props.testID.replace("payment-app-drag-", ""));

describe("App thanh toán page", () => {
  it("AC2: shows the intro, sections and badges", async () => {
    await open();
    expect(
      screen.getByText(
        "Chỉ app đang bật mới hiện khi thanh toán. Ngân hàng trong mã QR luôn được gợi ý, và ô tìm kiếm vẫn tìm được app đang tắt.",
      ),
    ).toBeTruthy();
    expect(screen.getByText("Đang bật · 4 · kéo để sắp xếp")).toBeTruthy();
    expect(screen.getByText("Ngân hàng")).toBeTruthy();
    expect(screen.getByText("Ví điện tử")).toBeTruthy();
    expect(screen.getByTestId("payment-apps-search").props.placeholder).toBe("Tìm trong 50+ ngân hàng / ví");
    expect(enabledIds()).toEqual(["mb", "tpb", "tcb", "momo"]);
    expect(screen.queryByTestId("payment-app-row-momo")).toBeTruthy();
    for (const id of ["zalopay", "vnpay"]) expect(screen.getByTestId(`payment-app-row-${id}`)).toBeTruthy();
    const badge = (id: string) => {
      const row = screen.getByTestId(`payment-app-row-${id}`);
      return within(row).queryByText("Tự điền") ? "Tự điền" : "Quét ảnh QR";
    };
    for (const id of ["mb", "bidv", "icb", "acb", "ocb"]) expect(badge(id)).toBe("Tự điền");
    for (const id of ["tpb", "tcb", "momo", "vcb", "zalopay", "vnpay"]) expect(badge(id)).toBe("Quét ảnh QR");
  });

  it("AC3: toggling an app off moves it back under its group", async () => {
    await open();
    await fireEvent(screen.getByTestId("payment-app-switch-momo"), "valueChange", false);
    await waitFor(() => expect(screen.getByText("Đang bật · 3 · kéo để sắp xếp")).toBeTruthy());
    expect(enabledIds()).not.toContain("momo");
    expect(await repo().getEnabledApps()).not.toContain("momo");
  });

  it("AC4: reordering by drag and by accessibility action persists", async () => {
    await open();
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
    const handle = screen.getByTestId("payment-app-handle-momo");
    await act(async () => {
      handle.props.onStartShouldSetResponder(mk(0, true));
      handle.props.onResponderGrant(mk(0, true));
      handle.props.onResponderMove(mk(-168, true));
      handle.props.onResponderRelease(mk(-168, false));
    });
    await waitFor(() => expect(enabledIds()).toEqual(["momo", "mb", "tpb", "tcb"]));
    await waitFor(async () => expect(await repo().getEnabledApps()).toEqual(["momo", "mb", "tpb", "tcb"]));
  });

  it("AC4: the move up accessibility action reorders", async () => {
    await open();
    await act(async () => {
      screen.getByTestId("payment-app-drag-tcb").props.onAccessibilityAction({ nativeEvent: { actionName: "moveUp" } });
    });
    await waitFor(() => expect(enabledIds()).toEqual(["mb", "tcb", "tpb", "momo"]));

    await waitFor(async () => expect(await repo().getEnabledApps()).toEqual(["mb", "tcb", "tpb", "momo"]));
  });

  it("AC5: search filters one flat list (including disabled apps) and clearing restores sections", async () => {
    await open();
    await fireEvent.changeText(screen.getByTestId("payment-apps-search"), "vnp");
    expect(screen.getByTestId("payment-app-row-vnpay")).toBeTruthy();
    expect(screen.queryByTestId("payment-app-row-mb")).toBeNull();
    expect(screen.queryByTestId("payment-apps-enabled-heading")).toBeNull();
    await fireEvent.changeText(screen.getByTestId("payment-apps-search"), "");
    expect(screen.getByTestId("payment-apps-enabled-heading")).toBeTruthy();
    expect(screen.getByTestId("payment-app-row-mb")).toBeTruthy();
    expect(screen.getByText("Ví điện tử")).toBeTruthy();
  });

  it("AC6: first use with nothing detected persists the default list", async () => {
    file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "mm-pay-")), "test.db");
    global.__SET_TEST_DB__ = openTestDb(file).db;
    await open();
    expect(enabledIds()).toHaveLength(9);
    expect(await repo().hasChosen()).toBe(true);
  });

  it("AC3: enabling an app adds it to Đang bật and persists", async () => {
    await open();
    await fireEvent(screen.getByTestId("payment-app-switch-vcb"), "valueChange", true);
    await waitFor(() => expect(screen.getByText("Đang bật · 5 · kéo để sắp xếp")).toBeTruthy());
    expect(enabledIds()).toContain("vcb");
    expect(await repo().getEnabledApps()).toEqual(["mb", "tpb", "tcb", "momo", "vcb"]);
  });
});
