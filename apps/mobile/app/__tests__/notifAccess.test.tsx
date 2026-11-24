import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { AppState, Platform } from "react-native";

import NotifAccessScreen from "../notif-access";
import { RepositoriesProvider } from "@/db/RepositoriesProvider";
import { createPaymentAppPrefsRepository, createPreferencesRepository } from "@/db/repositories";
import type { AnyDb } from "@/db/seed";
import { openTestDb } from "@/db/testing/testDb";
import { isAccessGranted, openAccessSettings } from "../../modules/notification-listener";

const mockBack = jest.fn();
jest.mock("expo-router", () => ({ useRouter: () => ({ back: mockBack }) }));
jest.mock("../../modules/notification-listener", () => ({
  isAccessGranted: jest.fn(async () => false),
  openAccessSettings: jest.fn(async () => undefined),
  subscribe: jest.fn(() => () => {}),
}));

let file: string;
const fresh = () => openTestDb(file).db as unknown as AnyDb;
const prefs = () => createPreferencesRepository(fresh());
const setOS = (os: string) => Object.defineProperty(Platform, "OS", { get: () => os, configurable: true });

beforeEach(() => {
  file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "mm-na-")), "test.db");
  mockBack.mockClear();
  (isAccessGranted as jest.Mock).mockResolvedValue(false);
  (openAccessSettings as jest.Mock).mockClear();
  setOS("android");
});
afterEach(() => {
  setOS("ios");
  jest.restoreAllMocks();
});

function captureAppState() {
  let handler: (s: string) => void = () => undefined;
  jest.spyOn(AppState, "addEventListener").mockImplementation(((_: string, h: (s: string) => void) => {
    handler = h;
    return { remove: jest.fn() };
  }) as never);
  return (s: string) => handler(s);
}

async function open() {
  const view = await render(
    <RepositoriesProvider db={fresh()}>
      <NotifAccessScreen />
    </RepositoriesProvider>,
  );
  await screen.findByTestId("screen-notif-access");
  return view;
}

describe("notif-access explainer", () => {
  it("AC1: renders the explainer copy and the enabled app names in order", async () => {
    await createPaymentAppPrefsRepository(fresh()).setEnabledOrder(["tpb", "momo"]);
    await open();
    expect(screen.getByText("Tự nhận biết chuyển khoản xong")).toBeTruthy();
    expect(screen.getByText(/Bạn không phải trả lời/)).toBeTruthy();
    await waitFor(() =>
      expect(screen.getByTestId("notif-access-apps").props.children).toBe(
        "Chỉ đọc thông báo của app bạn đã bật: TPBank, MoMo.",
      ),
    );
    expect(screen.getByText("Xử lý ngay trên máy. Không lưu, không gửi nội dung thông báo đi đâu.")).toBeTruthy();
    expect(screen.getByText("Tắt được bất cứ lúc nào trong Cài đặt.")).toBeTruthy();
    expect(screen.getByText("Tiếp tục")).toBeTruthy();
    expect(screen.getByText("Để sau")).toBeTruthy();
    expect(screen.getByText("“Tiếp tục” mở trang Truy cập thông báo của Android.")).toBeTruthy();
  });

  it("AC2: Tiếp tục opens the access settings exactly once, even on a double tap", async () => {
    await open();
    const btn = screen.getByTestId("notif-access-continue");
    await fireEvent.press(btn);
    await fireEvent.press(btn);
    await waitFor(() => expect(openAccessSettings).toHaveBeenCalledTimes(1));
  });

  it("AC2: Để sau leaves with the setting off", async () => {
    await prefs().setAutoDetectTransfers(true);
    await open();
    await fireEvent.press(screen.getByTestId("notif-access-later"));
    await waitFor(() => expect(mockBack).toHaveBeenCalled());
    expect(await prefs().getAutoDetectTransfers()).toBe(false);
    expect(openAccessSettings).not.toHaveBeenCalled();
  });

  it("AC4: returning with access granted saves the setting on and leaves", async () => {
    const fire = captureAppState();
    await open();
    await fireEvent.press(screen.getByTestId("notif-access-continue"));
    await waitFor(() => expect(openAccessSettings).toHaveBeenCalled());
    (isAccessGranted as jest.Mock).mockResolvedValue(true);
    await act(async () => fire("active"));
    await waitFor(async () => expect(await prefs().getAutoDetectTransfers()).toBe(true));
    await waitFor(() => expect(mockBack).toHaveBeenCalled());
  });

  it("AC4: returning without access keeps the setting off", async () => {
    const fire = captureAppState();
    await open();
    await fireEvent.press(screen.getByTestId("notif-access-continue"));
    await waitFor(() => expect(openAccessSettings).toHaveBeenCalled());
    await act(async () => fire("active"));
    await waitFor(() => expect(mockBack).toHaveBeenCalled());
    expect(await prefs().getAutoDetectTransfers()).toBe(false);
  });

  it("AC3: off Android it leaves right away", async () => {
    setOS("ios");
    await render(
      <RepositoriesProvider db={fresh()}>
        <NotifAccessScreen />
      </RepositoriesProvider>,
    );
    await waitFor(() => expect(mockBack).toHaveBeenCalled());
    expect(screen.queryByTestId("screen-notif-access")).toBeNull();
  });
});
