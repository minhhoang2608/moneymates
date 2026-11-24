import { fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import qr from "../../e2e/fixtures/qr.json";
import {
  createAppSettingRepository,
  createCategoryRepository,
  createHandOffMemoryRepository,
  createPaymentAppPrefsRepository,
  createTransactionRepository,
} from "@/db/repositories";
import type { AnyDb } from "@/db/seed";
import { openTestDb } from "@/db/testing/testDb";
import { setHapticsEnabled } from "@/lib/haptics";
import { hasValidCrc, parseVietQr } from "@/lib/vietqr";
import { scanResultToRoute } from "@/lib/vietqr/scanRoute";

jest.mock("@expo-google-fonts/inter", () => ({ useFonts: () => [true, null] }));
jest.mock("@/db/DatabaseProvider", () => ({
  DatabaseProvider: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock("@/db/client", () => {
  const db = new Proxy({}, { get: (_t, key) => (global.__PAY_TEST_DB__ as never)[key] });
  return { db };
});
// The hidden transfer image: expose the VietQR payload it encodes (the real SVG is covered in QrImageTemplate.test).
jest.mock("@/components/share/QrImageTemplate", () => {
  const { View } = require("react-native");
  const { buildQrImageContent } = require("@/lib/share/qrTemplate");
  return {
    QrImageTemplate: ({ getRef, ...props }: { getRef?: (r: unknown) => void }) => {
      getRef?.({ toDataURL: (cb: (d: string) => void) => cb("BASE64PNG") });
      return <View testID="qr-svg" value={buildQrImageContent(props as never).payload} templateProps={props} />;
    },
  };
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

const testDb = () => global.__PAY_TEST_DB__ as unknown as AnyDb;

const fetchMock = jest.fn(() => {
  throw new Error("network disabled");
});
const original = global.fetch;
beforeAll(() => {
  global.fetch = fetchMock as unknown as typeof fetch;
});
afterAll(() => {
  global.fetch = original;
  expect(fetchMock).not.toHaveBeenCalled(); // AC6
});

const urlFor = (text: string) => {
  const r = scanResultToRoute(text);
  if (!r.ok) throw new Error("expected ok");
  return `/pay-confirm?${new URLSearchParams(r.href.params).toString()}`;
};

describe("pay-confirm screen", () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    setHapticsEnabled(true);
    mockHandOff.mockReset();
    mockHandOff.mockImplementation(async () => ({ opened: true }));
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "mm-pay-")), "test.db");
    global.__PAY_TEST_DB__ = openTestDb(file).db;
  });

  afterEach(() => setHapticsEnabled(true));

  it("AC1: pay submit fires one light haptic", async () => {
    const Haptics = jest.requireMock("expo-haptics");
    await renderRouter("./app", { initialUrl: urlFor(qr.dynamic) });
    await fireEvent.press(await screen.findByTestId("pay-submit"));
    await waitFor(() => expect(mockHandOff).toHaveBeenCalledTimes(1));
    expect(Haptics.impactAsync).toHaveBeenCalledTimes(1);
    expect(Haptics.impactAsync).toHaveBeenCalledWith("light");
  });

  it("AC4: pay submit with disabled haptics stays silent", async () => {
    setHapticsEnabled(false);
    const Haptics = jest.requireMock("expo-haptics");
    await renderRouter("./app", { initialUrl: urlFor(qr.dynamic) });
    await fireEvent.press(await screen.findByTestId("pay-submit"));
    await waitFor(() => expect(mockHandOff).toHaveBeenCalledTimes(1));
    expect(Haptics.impactAsync).not.toHaveBeenCalled();
  });

  it("AC1: dynamic code is prefilled", async () => {
    await renderRouter("./app", { initialUrl: urlFor(qr.dynamic) });
    expect(await screen.findByText("NGUYEN VAN A")).toBeTruthy();
    expect(screen.getByText("TPBank · 0123456789")).toBeTruthy();
    expect(screen.getByTestId("pay-amount").props.value).toBe("55000");
    expect(screen.getByTestId("pay-note").props.value).toBe("PHO 24");
    expect(screen.getByText("Thanh toán 55.000đ qua TPBank")).toBeTruthy();
  });

  it.each([
    ["static", qr.static],
    ["merchant", qr.merchant],
  ])("AC2/AC4: %s code starts empty and disabled until an amount is typed", async (_n, text) => {
    await renderRouter("./app", { initialUrl: urlFor(text) });
    const amount = await screen.findByTestId("pay-amount");
    expect(amount.props.value).toBe("");
    expect(screen.getByTestId("pay-submit").props.accessibilityState.disabled).toBe(true);
    await fireEvent.changeText(amount, "55000");
    expect(screen.getByTestId("pay-submit").props.accessibilityState.disabled).toBe(false);
  });

  it("AC4: merchant code (no amount) is still saved with its payload", async () => {
    await renderRouter("./app", { initialUrl: urlFor(qr.merchant) });
    await fireEvent.changeText(await screen.findByTestId("pay-amount"), "55000");
    await fireEvent.press(screen.getByTestId("pay-submit"));
    await waitFor(() => expect(mockHandOff).toHaveBeenCalledTimes(1));
    const rows = await createTransactionRepository(testDb()).list();
    expect(rows).toHaveLength(1);
    expect(rows[0].qr_data).toBe(qr.merchant);
    expect(rows[0].source).toBe("qr");
    expect(rows[0].amount).toBe(55000);
  });

  it("AC3/AC5: submit saves one qr expense before hand-off; chosen app is remembered", async () => {
    const txRepo = createTransactionRepository(testDb());
    const food = (await createCategoryRepository(testDb()).listByKind("expense")).find((c) => c.name === "Ăn uống");
    let atHandOff: Awaited<ReturnType<typeof txRepo.list>> = [];
    mockHandOff.mockImplementation(async () => {
      atHandOff = await txRepo.list();
      return { opened: true };
    });

    await renderRouter("./app", { initialUrl: urlFor(qr.dynamic) });
    await fireEvent.press(await screen.findByTestId("pay-app-change"));
    await fireEvent.press(await screen.findByTestId("app-mb"));
    await waitFor(() => expect(screen.getByText("Thanh toán 55.000đ qua MBBank")).toBeTruthy());
    await fireEvent.press(screen.getByTestId("pay-submit"));
    await fireEvent.press(screen.getByTestId("pay-submit"));
    await waitFor(() => expect(mockHandOff).toHaveBeenCalledTimes(1));
    expect(jest.mocked(mockHandOff).mock.calls[0][0].id).toBe("mb");
    expect(jest.mocked(mockHandOff).mock.calls[0][1].model.payload).toBe(qr.dynamic);
    expect(jest.mocked(mockHandOff).mock.calls[0][1]).toMatchObject({ amount: 55000, note: "PHO 24" });

    // The row existed when the hand-off ran.
    expect(atHandOff).toHaveLength(1);
    const rows = await txRepo.list();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      amount: 55000,
      currency: "VND",
      source: "qr",
      qr_data: qr.dynamic,
      category_id: food?.id,
    });
    expect(food).toBeTruthy();

    // AC5: remembered, and listed first on the next visit.
    expect(await createAppSettingRepository(testDb()).get("pay.recent_apps")).toEqual(["mb"]);
    expect(await createHandOffMemoryRepository(testDb()).getLastUsedByBank()).toEqual({ "970423": "mb" });
  });

  it.each([
    ["rejects", async () => Promise.reject(new Error("boom"))],
    ["opened:false", async () => ({ opened: false })],
  ])("AC5: hand-off %s → the transaction still exists", async (_n, impl) => {
    const txRepo = createTransactionRepository(testDb());
    let atHandOff = 0;
    mockHandOff.mockImplementation(async (...a: unknown[]) => {
      atHandOff = (await txRepo.list()).length;
      return impl(...(a as []));
    });
    await renderRouter("./app", { initialUrl: urlFor(qr.dynamic) });
    await fireEvent.press(await screen.findByTestId("pay-submit"));
    await waitFor(() => expect(mockHandOff).toHaveBeenCalledTimes(1));
    expect(atHandOff).toBe(1);
    expect(await txRepo.list()).toHaveLength(1);
  });

  it("AC1: the QR bank is preselected as one row with no extra choice", async () => {
    await renderRouter("./app", { initialUrl: urlFor(qr.dynamic) });
    expect(await screen.findByTestId("pay-app-row-name")).toHaveTextContent("TPBank");
    expect(screen.getByTestId("pay-app-row-badge")).toHaveTextContent("Quét ảnh QR");
    expect(screen.getByTestId("pay-app-change")).toHaveTextContent("Đổi ›");
    expect(screen.getByText("Thanh toán 55.000đ qua TPBank")).toBeTruthy();
    expect(screen.queryAllByTestId(/^app-/)).toHaveLength(0);
    expect(screen.queryByTestId("pay-app-sheet")).toBeNull();
  });

  it("AC1: the app last used for this bank is preselected", async () => {
    await createHandOffMemoryRepository(testDb()).setLastUsedForBank("970423", "mb");
    await renderRouter("./app", { initialUrl: urlFor(qr.dynamic) });
    await waitFor(() => expect(screen.getByTestId("pay-app-row-name")).toHaveTextContent("MBBank"));
    expect(screen.getByTestId("pay-app-row-badge")).toHaveTextContent("Tự điền");
    expect(screen.getByText("Thanh toán 55.000đ qua MBBank")).toBeTruthy();
  });

  it("AC2: the sheet searches hidden apps and picking one updates the row and the button", async () => {
    await createPaymentAppPrefsRepository(testDb()).setEnabledOrder(["tpb", "mb"]);
    await renderRouter("./app", { initialUrl: urlFor(qr.dynamic) });
    await fireEvent.press(await screen.findByTestId("pay-app-change"));
    expect(await screen.findByTestId("pay-app-sheet")).toBeTruthy();
    expect(screen.queryByTestId("app-vcb")).toBeNull();
    await fireEvent.changeText(screen.getByTestId("pay-app-search"), "vietcom");
    expect(await screen.findByTestId("app-vcb")).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId("pay-app-search"), "zzzz");
    expect(await screen.findByTestId("pay-app-empty")).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId("pay-app-search"), "");
    await fireEvent.press(await screen.findByTestId("app-mb"));
    await waitFor(() => expect(screen.queryByTestId("pay-app-sheet")).toBeNull());
    expect(screen.getByTestId("pay-app-row-name")).toHaveTextContent("MBBank");
    expect(screen.getByTestId("pay-app-row-badge")).toHaveTextContent("Tự điền");
    expect(screen.getByText("Thanh toán 55.000đ qua MBBank")).toBeTruthy();
  });

  it("AC3: the manage link opens the payment apps page", async () => {
    await renderRouter("./app", { initialUrl: urlFor(qr.dynamic) });
    await fireEvent.press(await screen.findByTestId("pay-app-change"));
    await fireEvent.press(await screen.findByTestId("pay-app-manage"));
    expect(await screen.findByTestId("screen-payment-apps")).toBeTruthy();
  });

  it("the saved QR is regenerated from the confirmed amount and note", async () => {
    await renderRouter("./app", { initialUrl: urlFor(qr.dynamic) });
    await fireEvent.changeText(await screen.findByTestId("pay-amount"), "80000");
    await fireEvent.changeText(screen.getByTestId("pay-note"), "Ca phe");
    const value = screen.getByTestId("qr-svg", { includeHiddenElements: true }).props.value as string;
    expect(value).not.toBe(qr.dynamic);
    expect(hasValidCrc(value)).toBe(true);
    expect(parseVietQr(value)).toMatchObject({ kind: "vietqr", amount: 80000, message: "Ca phe" });
  });

  it("passes the confirmed amount, edited note and scanned payload to the image template", async () => {
    await renderRouter("./app", { initialUrl: urlFor(qr.dynamic) });
    await fireEvent.changeText(await screen.findByTestId("pay-amount"), "80000");
    await fireEvent.changeText(screen.getByTestId("pay-note"), "Ca phe");
    const props = screen.getByTestId("qr-svg", { includeHiddenElements: true }).props.templateProps;
    expect(props).toMatchObject({ amount: 80000, message: "Ca phe", fallbackPayload: qr.dynamic });
  });

  it("does not crash when the note is too long for a QR", async () => {
    await renderRouter("./app", { initialUrl: urlFor(qr.dynamic) });
    await fireEvent.changeText(screen.getByTestId("pay-note"), "x".repeat(150));
    expect(screen.getByTestId("qr-svg", { includeHiddenElements: true })).toBeTruthy();
  });

  it("the saved QR carries the confirmed amount when the scanned QR had none", async () => {
    await renderRouter("./app", { initialUrl: urlFor(qr.static) });
    await fireEvent.changeText(await screen.findByTestId("pay-amount"), "30000");
    const value = screen.getByTestId("qr-svg", { includeHiddenElements: true }).props.value as string;
    expect(parseVietQr(value)).toMatchObject({ kind: "vietqr", amount: 30000 });
  });

  it("share option shows on Android only", async () => {
    const rn = jest.requireActual("react-native");
    const prev = rn.Platform.OS;
    rn.Platform.OS = "android";
    await renderRouter("./app", { initialUrl: urlFor(qr.dynamic) });
    expect(await screen.findByTestId("pay-share-qr")).toBeTruthy();
    rn.Platform.OS = "ios";
    screen.unmount();
    await renderRouter("./app", { initialUrl: urlFor(qr.dynamic) });
    await screen.findByTestId("pay-submit");
    expect(screen.queryByTestId("pay-share-qr")).toBeNull();
    rn.Platform.OS = prev;
  });
});
