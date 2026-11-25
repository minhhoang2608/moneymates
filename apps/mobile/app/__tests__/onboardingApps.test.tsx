import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";

import { createPaymentAppPrefsRepository } from "@/db/repositories";
import type { AnyDb } from "@/db/seed";
import { openTestDb } from "@/db/testing/testDb";
import { getInstalledPayApps } from "@/lib/payConfirm/getInstalledPayApps";

jest.mock("@expo-google-fonts/inter", () => ({ useFonts: () => [true, null] }));
jest.mock("@/db/DatabaseProvider", () => ({
  DatabaseProvider: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock("@/db/client", () => {
  const db = new Proxy({}, { get: (_t, key) => (global.__ONBAPPS_TEST_DB__ as never)[key] });
  return { db };
});
jest.mock("@/lib/payConfirm/getInstalledPayApps", () => ({ getInstalledPayApps: jest.fn() }));

declare global {
  var __ONBAPPS_TEST_DB__: object;
}

const installed = getInstalledPayApps as jest.Mock;
let file: string;
const repo = () => createPaymentAppPrefsRepository(openTestDb(file).db as unknown as AnyDb);

beforeEach(() => {
  installed.mockReset().mockResolvedValue([]);
  file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "mm-onbapps-")), "test.db");
  global.__ONBAPPS_TEST_DB__ = openTestDb(file).db;
});

async function open() {
  await renderRouter("./app", { initialUrl: "/onboarding/apps" });
  await screen.findByText("Bạn hay dùng app nào?");
}
const tap = (id: string) => fireEvent.press(screen.getByTestId(`payment-app-check-${id}`));

describe("onboarding step 2", () => {
  it("counts selected apps in the CTA", async () => {
    await open();
    for (const id of ["mb", "tpb", "tcb", "momo"]) await tap(id);
    expect(screen.getByText("Tiếp tục · 4 app")).toBeTruthy();
    await tap("tcb");
    expect(screen.getByText("Tiếp tục · 3 app")).toBeTruthy();
  });

  it("Tiếp tục saves exactly the selection and disables the rest", async () => {
    await repo().setEnabledOrder(["vcb", "bidv"]);
    await open();
    await waitFor(() => expect(installed).toHaveBeenCalled());
    // Pre-seeded rows must not leak into the selection.
    for (const id of ["mb", "tpb", "tcb", "momo"]) await tap(id);
    await fireEvent.press(screen.getByTestId("onb-next"));
    await screen.findByText("Bước 3/4");
    expect(await repo().getEnabledApps()).toEqual(["mb", "tpb", "tcb", "momo"]);
  });

  it("a searched app can be selected and counted", async () => {
    await open();
    await fireEvent.changeText(screen.getByTestId("onb-apps-search"), "zalo");
    await tap("zalopay");
    expect(screen.getByText("Tiếp tục · 1 app")).toBeTruthy();
  });

  it("Để sau does not write", async () => {
    await repo().setEnabledOrder(["vcb", "bidv"]);
    await open();
    await tap("mb");
    await fireEvent.press(screen.getByTestId("onb-skip"));
    await screen.findByText("Bước 3/4");
    expect(await repo().getEnabledApps()).toEqual(["vcb", "bidv"]);
  });

  it("preselects installed apps", async () => {
    installed.mockResolvedValue(["tcb", "momo"]);
    await open();
    expect(await screen.findByText("Tiếp tục · 2 app")).toBeTruthy();
    expect(screen.getByTestId("payment-app-check-tcb").props.accessibilityState.checked).toBe(true);
    expect(screen.getByTestId("payment-app-check-mb").props.accessibilityState.checked).toBe(false);
  });

  it("nothing selected: plain CTA, still advances", async () => {
    await open();
    expect(screen.getByText("Tiếp tục")).toBeTruthy();
    await fireEvent.press(screen.getByTestId("onb-next"));
    await screen.findByText("Bước 3/4");
  });

  it("Xem tất cả expands in place", async () => {
    await open();
    await fireEvent.press(screen.getByTestId("onb-apps-show-all"));
    expect(screen.queryByTestId("onb-apps-show-all")).toBeNull();
    expect(screen.getByText("Bước 2/4")).toBeTruthy();
  });
});
