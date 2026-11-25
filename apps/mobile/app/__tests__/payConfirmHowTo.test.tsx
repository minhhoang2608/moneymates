import { fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import qr from "../../e2e/fixtures/qr.json";
import { createPreferencesRepository, createTransactionRepository } from "@/db/repositories";
import type { AnyDb } from "@/db/seed";
import { openTestDb } from "@/db/testing/testDb";
import { vi } from "@/i18n/vi";
import { usePendingHandOff } from "@/stores/pendingHandOff";
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

describe("pay-confirm how-to line", () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    setHapticsEnabled(true);
    mockHandOff.mockReset();
    mockHandOff.mockImplementation(async () => ({ opened: true }));
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "mm-howto-")), "test.db");
    global.__PAY_TEST_DB__ = openTestDb(file).db;
  });

  it("AC1: shows the how-to line under the pay button for TPBank", async () => {
    await renderRouter("./app", { initialUrl: urlFor(qr.dynamic) });
    const line = await screen.findByTestId("pay-howto");
    expect(line).toHaveTextContent(
      "Trong TPBank: Quét QR → Ảnh → chọn ảnh đầu tiên. Ảnh QR tạm tự xoá khi bạn quay lại.",
    );
  });

  it("AC1: hides the line for an autofill app", async () => {
    await renderRouter("./app", { initialUrl: urlFor(qr.dynamic) });
    await fireEvent.press(await screen.findByTestId("pay-app-change"));
    await fireEvent.press(await screen.findByTestId("app-mb"));
    await waitFor(() => expect(screen.getByText("Thanh toán 55.000đ qua MBBank")).toBeTruthy());
    expect(screen.queryByTestId("pay-howto")).toBeNull();
  });

  it("AC1: the line follows the selected app", async () => {
    await renderRouter("./app", { initialUrl: urlFor(qr.dynamic) });
    await fireEvent.press(await screen.findByTestId("pay-app-change"));
    await fireEvent.changeText(screen.getByTestId("pay-app-search"), "vietcom");
    await fireEvent.press(await screen.findByTestId("app-vcb"));
    await waitFor(() => expect(screen.getByTestId("pay-howto")).toHaveTextContent(/^Trong Vietcombank: /));
  });

  it("AC2: first payment with a non-autofill bank hands off without a sheet", async () => {
    const Haptics = jest.requireMock("expo-haptics");
    await renderRouter("./app", { initialUrl: urlFor(qr.dynamic) });
    await fireEvent.press(await screen.findByTestId("pay-submit"));
    await waitFor(() => expect(mockHandOff).toHaveBeenCalledTimes(1));
    expect(jest.mocked(mockHandOff).mock.calls[0][0].id).toBe("tpb");
    expect(await createTransactionRepository(testDb()).list()).toHaveLength(1);
    expect(screen.queryByTestId("pay-app-sheet")).toBeNull();
    expect(Haptics.impactAsync).toHaveBeenCalledTimes(1);
  });

  it("no_image mode: shows the paste line and hands off with the mode, no QR wording", async () => {
    await createPreferencesRepository(testDb()).setNonAutofillMode("no_image");
    await renderRouter("./app", { initialUrl: urlFor(qr.dynamic) });
    await waitFor(() => expect(screen.getByTestId("pay-howto")).toHaveTextContent(vi.payConfirm.howToPaste));
    const line = screen.getByTestId("pay-howto");
    expect(line).not.toHaveTextContent("Ảnh QR tạm");
    expect(line).not.toHaveTextContent("chọn ảnh");
    await fireEvent.press(screen.getByTestId("pay-submit"));
    await waitFor(() => expect(mockHandOff).toHaveBeenCalledTimes(1));
    expect(jest.mocked(mockHandOff).mock.calls[0][1]).toMatchObject({ nonAutofillMode: "no_image" });
  });

  it("no_image mode: paste hand-off stores no reopen data (no 'Mở lại' row)", async () => {
    await createPreferencesRepository(testDb()).setNonAutofillMode("no_image");
    mockHandOff.mockImplementation(async () => ({
      opened: true,
      mode: "direct",
      decision: "open-only",
      qrStorage: "none",
      handOffMethod: "paste",
    }));
    await renderRouter("./app", { initialUrl: urlFor(qr.dynamic) });
    await fireEvent.press(await screen.findByTestId("pay-submit"));
    await waitFor(() => expect(mockHandOff).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(usePendingHandOff.getState().pending?.txId).toBeTruthy());
    expect(usePendingHandOff.getState().pending?.reopen).toBeUndefined();
  });

  it("default image mode: direct hand-off keeps the reopen data (regression)", async () => {
    mockHandOff.mockImplementation(async () => ({
      opened: true,
      mode: "direct",
      decision: "open-only",
      qrStorage: "album",
      qrAssetId: "a1",
    }));
    await renderRouter("./app", { initialUrl: urlFor(qr.dynamic) });
    await fireEvent.press(await screen.findByTestId("pay-submit"));
    await waitFor(() => expect(mockHandOff).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(usePendingHandOff.getState().pending?.reopen?.app.id).toBe("tpb"));
  });

  it("howToText joins the parts", () => {
    expect(vi.payConfirm.howToText("TPBank")).toBe(
      "Trong TPBank: Quét QR → Ảnh → chọn ảnh đầu tiên. Ảnh QR tạm tự xoá khi bạn quay lại.",
    );
  });
});
