import { act, fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";
import * as camera from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { Linking } from "react-native";

import { vi } from "@/i18n/vi";
import qr from "../../e2e/fixtures/qr.json";

// expo-router/testing-library registers an empty reanimated mock on import: override it afterwards.
Object.assign(require("react-native-reanimated"), require("../../jest.reanimated-mock"));
jest.mock("@/db/client", () => {
  const { openTestDb } = jest.requireActual("@/db/testing/testDb");
  return { db: openTestDb().db };
});
jest.mock("@expo-google-fonts/inter", () => ({ useFonts: () => [true, null] }));
jest.mock("@/db/DatabaseProvider", () => ({
  DatabaseProvider: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock("expo-image-picker", () => ({ launchImageLibraryAsync: jest.fn() }));

const cam = (camera as any).__state;
const scanFromURL = camera.scanFromURLAsync as jest.Mock;
const picker = ImagePicker.launchImageLibraryAsync as jest.Mock;

async function open() {
  await renderRouter("./app", { initialUrl: "/" });
  await waitFor(() => expect(screen.getByTestId("tab-qr")).toBeTruthy());
  await fireEvent.press(screen.getByTestId("tab-qr"));
  await waitFor(() => expect(screen.getByTestId("screen-scan")).toBeTruthy());
}
const scan = (data: string) => act(async () => cam.lastProps.onBarcodeScanned({ data }));

beforeEach(() => {
  cam.permission = { granted: true, canAskAgain: true };
  scanFromURL.mockReset().mockResolvedValue([]);
  picker.mockReset();
  delete process.env.EXPO_PUBLIC_E2E;
});

describe("scan screen", () => {
  it("camera scan navigates to /pay-confirm once", async () => {
    await open();
    await scan(qr.dynamic);
    await scan(qr.dynamic);
    await waitFor(() => expect(screen).toHavePathname("/pay-confirm"));
    expect(screen).toHaveSearchParams(
      expect.objectContaining({ bankName: "TPBank", amount: "55000", message: "PHO 24" }),
    );
    expect(screen.getByTestId("pay-amount").props.value).toBe("55000");
  });

  it("navigates immediately on detection, without waiting for the flash", async () => {
    await open();
    jest.useFakeTimers();
    try {
      await scan(qr.dynamic);
      expect(screen).toHavePathname("/pay-confirm");
    } finally {
      jest.useRealTimers();
    }
  });

  it("static code navigates without amount", async () => {
    await open();
    await scan(qr.static);
    await waitFor(() => expect(screen).toHavePathname("/pay-confirm"));
    expect(screen.getByTestId("pay-amount").props.value).toBe("");
  });

  it("invalid scan shows scan-error and stays on /scan", async () => {
    await open();
    await scan(qr.invalid);
    expect(screen.getByTestId("scan-error")).toBeTruthy();
    expect(screen.queryByTestId("scan-flash")).toBeNull();
    expect(screen).toHavePathname("/scan");
  });

  it("gallery image with no QR shows the error", async () => {
    picker.mockResolvedValue({ canceled: false, assets: [{ uri: "file:///x.png" }] });
    await open();
    await fireEvent.press(screen.getByTestId("scan-gallery-button"));
    await waitFor(() => expect(screen.getByTestId("scan-error")).toBeTruthy());
    expect(screen).toHavePathname("/scan");
  });

  it("gallery image with a QR navigates", async () => {
    picker.mockResolvedValue({ canceled: false, assets: [{ uri: "file:///x.png" }] });
    scanFromURL.mockResolvedValue([{ data: qr.dynamic }]);
    await open();
    await fireEvent.press(screen.getByTestId("scan-gallery-button"));
    await waitFor(() => expect(screen).toHavePathname("/pay-confirm"));
  });

  it("gallery cancelled does nothing", async () => {
    picker.mockResolvedValue({ canceled: true, assets: null });
    await open();
    await fireEvent.press(screen.getByTestId("scan-gallery-button"));
    await waitFor(() => expect(picker).toHaveBeenCalled());
    expect(screen.queryByTestId("scan-error")).toBeNull();
    expect(screen).toHavePathname("/scan");
  });

  it("flash toggles enableTorch", async () => {
    await open();
    expect(cam.lastProps.enableTorch).toBe(false);
    await fireEvent.press(screen.getByTestId("scan-flash-button"));
    expect(cam.lastProps.enableTorch).toBe(true);
    await fireEvent.press(screen.getByTestId("scan-flash-button"));
    expect(cam.lastProps.enableTorch).toBe(false);
  });

  it("permission denied shows explanation and opens settings", async () => {
    cam.permission = { granted: false, canAskAgain: false };
    const spy = jest.spyOn(Linking, "openSettings").mockResolvedValue();
    await open();
    expect(screen.queryByTestId("camera-view")).toBeNull();
    expect(screen.queryByTestId("scan-grant")).toBeNull();
    await fireEvent.press(screen.getByTestId("scan-open-settings"));
    expect(spy).toHaveBeenCalled();
  });

  it("undetermined camera: tab-qr requests once, then shows the camera on grant", async () => {
    const request = (camera as any).Camera.requestCameraPermissionsAsync as jest.Mock;
    request.mockClear();
    cam.permission = { status: "undetermined", granted: false, canAskAgain: true };
    request.mockImplementationOnce(async () => {
      cam.permission = { status: "granted", granted: true, canAskAgain: true };
      return cam.permission;
    });
    await open();
    expect(request).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.getByTestId("camera-view")).toBeTruthy());
  });

  it("granted camera: no request is made", async () => {
    const request = (camera as any).Camera.requestCameraPermissionsAsync as jest.Mock;
    request.mockClear();
    await open();
    expect(request).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByTestId("camera-view")).toBeTruthy());
  });

  it("denied camera: no request, camera not mounted, explanation shown", async () => {
    const request = (camera as any).Camera.requestCameraPermissionsAsync as jest.Mock;
    request.mockClear();
    cam.permission = { status: "denied", granted: false, canAskAgain: false };
    await open();
    expect(request).not.toHaveBeenCalled();
    expect(screen.queryByTestId("camera-view")).toBeNull();
    await waitFor(() => expect(screen.getByText(vi.scan.permissionDenied)).toBeTruthy());
  });

  it("E2E mode feeds the fixture without a camera", async () => {
    process.env.EXPO_PUBLIC_E2E = "1";
    await open();
    expect(screen.queryByTestId("camera-view")).toBeNull();
    await fireEvent.press(screen.getByTestId("scan-e2e-feed"));
    await waitFor(() => expect(screen).toHavePathname("/pay-confirm"));
    expect(screen.getByTestId("pay-confirm-bank")).toBeTruthy();
  });
});
