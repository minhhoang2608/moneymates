import { act, render } from "@testing-library/react-native";
import { AppState, type AppStateStatus } from "react-native";

import { HandOffReturnWatcher } from "../HandOffReturnWatcher";
import { usePendingHandOff } from "@/stores/pendingHandOff";

const mockRecordReturn = jest.fn(async () => null);
jest.mock("@/db/RepositoriesProvider", () => ({
  useRepositories: () => ({ handOffs: { recordReturn: mockRecordReturn } }),
}));
jest.mock("@/lib/qrImage/useQrCleanupOnReturn", () => ({ useQrCleanupOnReturn: () => undefined }));

let emit: (s: AppStateStatus) => void = () => {};
beforeEach(() => {
  mockRecordReturn.mockClear();
  jest.spyOn(AppState, "addEventListener").mockImplementation((_t, cb) => {
    emit = cb as (s: AppStateStatus) => void;
    return { remove: jest.fn() } as never;
  });
});
afterEach(() => jest.restoreAllMocks());

describe("HandOffReturnWatcher", () => {
  it("renders nothing, records the return and forgets the pending hand-off", async () => {
    usePendingHandOff.getState().set({ txId: "t1", amount: 55000, label: "Phở" });
    usePendingHandOff.getState().setHandOffId("h1");
    const view = await render(<HandOffReturnWatcher />);
    expect(view.toJSON()).toBeNull();
    await act(async () => emit("background"));
    await act(async () => emit("active"));
    expect(mockRecordReturn).toHaveBeenCalledWith("h1", expect.any(Date));
    expect(usePendingHandOff.getState().pending).toBeNull();
  });

  it("does nothing on active without a background first", async () => {
    usePendingHandOff.getState().set({ txId: "t1", amount: 1, label: "" });
    usePendingHandOff.getState().setHandOffId("h1");
    await render(<HandOffReturnWatcher />);
    await act(async () => emit("active"));
    expect(mockRecordReturn).not.toHaveBeenCalled();
  });
});
