import { fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import qr from "../../e2e/fixtures/qr.json";
import { createAppSettingRepository } from "@/db/repositories";
import type { AnyDb } from "@/db/seed";
import { openTestDb } from "@/db/testing/testDb";
import { setHapticsEnabled } from "@/lib/haptics";
import { COACH_KEY } from "@/lib/payConfirm/coach";
import { scanResultToRoute } from "@/lib/vietqr/scanRoute";
import { useToast } from "@/stores/toast";

jest.mock("@expo-google-fonts/inter", () => ({ useFonts: () => [true, null] }));
jest.mock("@/db/DatabaseProvider", () => ({
  DatabaseProvider: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock("@/db/client", () => {
  const db = new Proxy({}, { get: (_t, key) => (global.__PAY_TEST_DB__ as never)[key] });
  return { db };
});
const mockHandOff = jest.fn();
jest.mock("@/lib/payConfirm/handOffDeps", () => ({
  makeHandOff: jest.fn(
    () =>
      (...args: unknown[]) =>
        mockHandOff(...args),
  ),
}));

declare global {
  var __PAY_TEST_DB__: object;
}
const settings = () => createAppSettingRepository(global.__PAY_TEST_DB__ as unknown as AnyDb);

const urlFor = (text: string) => {
  const r = scanResultToRoute(text);
  if (!r.ok) throw new Error("expected ok");
  return `/pay-confirm?${new URLSearchParams(r.href.params).toString()}`;
};

const TEXT = "Trong Techcombank: bấm Quét QR → biểu tượng Ảnh → chọn ảnh đầu tiên";

async function open(appId: string) {
  await renderRouter("./app", { initialUrl: urlFor(qr.dynamic) });
  await fireEvent.press(await screen.findByTestId(`app-${appId}`));
  await fireEvent.press(screen.getByTestId("pay-submit"));
}

describe("pay-confirm coach sheet", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setHapticsEnabled(true);
    mockHandOff.mockReset();
    mockHandOff.mockImplementation(async () => ({ opened: true }));
    useToast.getState().hide();
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "mm-coach-")), "test.db");
    global.__PAY_TEST_DB__ = openTestDb(file).db;
  });

  afterEach(() => setHapticsEnabled(true));

  it("AC1: coach confirm fires a light haptic (after the pay submit one)", async () => {
    const Haptics = jest.requireMock("expo-haptics");
    await open("tcb");
    await fireEvent.press(await screen.findByTestId("coach-confirm"));
    await waitFor(() => expect(mockHandOff).toHaveBeenCalledTimes(1));
    expect(Haptics.impactAsync).toHaveBeenCalledTimes(2);
    expect(Haptics.impactAsync).toHaveBeenLastCalledWith("light");
  });

  it("AC4: coach confirm with disabled haptics stays silent", async () => {
    setHapticsEnabled(false);
    const Haptics = jest.requireMock("expo-haptics");
    await open("tcb");
    await fireEvent.press(await screen.findByTestId("coach-confirm"));
    await waitFor(() => expect(mockHandOff).toHaveBeenCalledTimes(1));
    expect(Haptics.impactAsync).not.toHaveBeenCalled();
  });

  it("AC1: a non-autofill bank shows the sheet and waits for confirm", async () => {
    await open("tcb");
    expect((await screen.findByTestId("coach-text")).children.join("")).toBe(TEXT);
    expect(mockHandOff).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId("coach-confirm"));
    await waitFor(() => expect(mockHandOff).toHaveBeenCalledTimes(1));
  });

  it("AC3: confirming without the tick stores nothing and the sheet shows again", async () => {
    await open("tcb");
    await fireEvent.press(await screen.findByTestId("coach-confirm"));
    await waitFor(() => expect(mockHandOff).toHaveBeenCalledTimes(1));
    expect(await settings().get(COACH_KEY)).toBeNull();
  });

  it("AC2: ticking stores the bank", async () => {
    await open("tcb");
    await fireEvent.press(await screen.findByTestId("coach-dont-show"));
    await fireEvent.press(screen.getByTestId("coach-confirm"));
    await waitFor(() => expect(mockHandOff).toHaveBeenCalledTimes(1));
    expect(await settings().get(COACH_KEY)).toEqual(["tcb"]);
  });

  it("AC2: a dismissed bank only shows a toast", async () => {
    await settings().set(COACH_KEY, ["tcb"]);
    await open("tcb");
    await waitFor(() => expect(mockHandOff).toHaveBeenCalledTimes(1));
    expect(screen.queryByTestId("coach-sheet")).toBeNull();
    expect(useToast.getState().text).toBe(TEXT);
  });

  it("AC4: an autofill bank gets neither sheet nor toast", async () => {
    await open("mb");
    await waitFor(() => expect(mockHandOff).toHaveBeenCalledTimes(1));
    expect(screen.queryByTestId("coach-sheet")).toBeNull();
    expect(useToast.getState().text).toBeNull();
  });

  it("closing the sheet cancels the hand-off", async () => {
    await open("tcb");
    await fireEvent.press(await screen.findByTestId("coach-close"));
    await waitFor(() => expect(screen.queryByTestId("coach-sheet")).toBeNull());
    expect(mockHandOff).not.toHaveBeenCalled();
  });
});
