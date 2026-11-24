import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import { PermissionRow } from "@/components/onboarding/PermissionRow";
import { PermissionsStep } from "@/components/onboarding/PermissionsStep";
import { setPermissionAdapter, type PermissionAdapter } from "@/lib/permissions";

function fakeAdapter(initial: Record<string, "undetermined" | "granted" | "denied">) {
  const adapter: PermissionAdapter & { get: jest.Mock; request: jest.Mock; openSettings: jest.Mock } = {
    get: jest.fn(async (k) => ({ status: initial[k] ?? "undetermined", canAskAgain: true })),
    request: jest.fn(async (_k) => ({ status: "granted" as const, granted: true })),
    openSettings: jest.fn(async () => undefined),
  };
  setPermissionAdapter(adapter);
  return adapter;
}

afterEach(() => setPermissionAdapter(null));

async function renderStep(onNext = jest.fn(), onSkip = jest.fn()) {
  await render(<PermissionsStep onNext={onNext} onSkip={onSkip} />);
  await waitFor(() => expect(screen.queryByTestId("perm-ask-camera")).toBeTruthy());
  return { onNext, onSkip };
}

describe("PermissionsStep", () => {
  it("renders copy and three rows without requesting anything", async () => {
    const adapter = fakeAdapter({});
    await renderStep();
    expect(screen.getByText("Cho phép những gì cần")).toBeTruthy();
    expect(screen.getByText("Bước 3/4")).toBeTruthy();
    expect(screen.getByText("Camera")).toBeTruthy();
    expect(screen.getByText("Ảnh")).toBeTruthy();
    expect(screen.getByText("Micro & giọng nói")).toBeTruthy();
    expect(screen.getByText("Quét mã QR thanh toán, chụp bill.")).toBeTruthy();
    expect(screen.getByText(/Mỗi nút mở hộp thoại/)).toBeTruthy();
    expect(screen.queryByText("Thông báo ngân hàng")).toBeNull();
    expect(screen.getByTestId("perm-ask-photos")).toBeTruthy();
    expect(screen.getByTestId("perm-ask-microphone")).toBeTruthy();
    expect(adapter.request).not.toHaveBeenCalled();
    expect(adapter.get).toHaveBeenCalledTimes(3);
  });

  it("requests camera once even on double tap, then shows Đã bật", async () => {
    const adapter = fakeAdapter({});
    let release: () => void = () => undefined;
    adapter.request.mockImplementation(
      () => new Promise((resolve) => (release = () => resolve({ status: "granted" }))),
    );
    await renderStep();
    const button = screen.getByTestId("perm-ask-camera");
    await fireEvent.press(button);
    await fireEvent.press(button);
    await act(async () => release());
    await waitFor(() => expect(screen.getByTestId("perm-granted-camera")).toBeTruthy());
    expect(adapter.request).toHaveBeenCalledTimes(1);
    expect(adapter.request).toHaveBeenCalledWith("camera");
    expect(screen.getByText("Đã bật")).toBeTruthy();
  });

  it("requests photos through the module", async () => {
    const adapter = fakeAdapter({});
    await renderStep();
    await fireEvent.press(screen.getByTestId("perm-ask-photos"));
    await waitFor(() => expect(adapter.request).toHaveBeenCalledWith("photos"));
  });

  it("denied row opens settings and never re-requests", async () => {
    const adapter = fakeAdapter({ photos: "denied" });
    await renderStep();
    await waitFor(() => expect(screen.getByTestId("perm-settings-photos")).toBeTruthy());
    await fireEvent.press(screen.getByTestId("perm-settings-photos"));
    expect(adapter.openSettings).toHaveBeenCalledTimes(1);
    expect(adapter.request).not.toHaveBeenCalled();
  });

  it("Để sau and Tiếp tục only navigate", async () => {
    const adapter = fakeAdapter({});
    const { onNext, onSkip } = await renderStep();
    await fireEvent.press(screen.getByTestId("perm-skip"));
    await fireEvent.press(screen.getByTestId("perm-next"));
    expect(onSkip).toHaveBeenCalledTimes(1);
    expect(onNext).toHaveBeenCalledTimes(1);
    expect(adapter.request).not.toHaveBeenCalled();
    await act(async () => undefined);
  });
});

describe("PermissionRow", () => {
  const base = {
    id: "camera",
    icon: null,
    label: "Camera",
    description: "d",
    onAsk: jest.fn(),
    onOpenSettings: jest.fn(),
  };
  it("not asked shows Tiếp tục", async () => {
    await render(<PermissionRow {...base} state="not_asked" />);
    expect(screen.getByTestId("perm-ask-camera")).toBeTruthy();
  });
  it("granted shows a non-pressable Đã bật chip", async () => {
    await render(<PermissionRow {...base} state="granted" />);
    expect(screen.getByText("Đã bật")).toBeTruthy();
    expect(screen.queryByTestId("perm-ask-camera")).toBeNull();
  });
  it("denied shows Mở Cài đặt", async () => {
    await render(<PermissionRow {...base} state="denied" />);
    await fireEvent.press(screen.getByTestId("perm-settings-camera"));
    expect(base.onOpenSettings).toHaveBeenCalled();
  });
});
