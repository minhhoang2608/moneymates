import { usePendingHandOff } from "../pendingHandOff";

describe("pendingHandOff store", () => {
  beforeEach(() => usePendingHandOff.getState().clear());

  it("keeps the pending payment and its hand-off id until cleared", () => {
    usePendingHandOff.getState().setHandOffId("ignored");
    expect(usePendingHandOff.getState().pending).toBeNull();
    usePendingHandOff.getState().set({ txId: "t1", amount: 55000, label: "Phở" });
    usePendingHandOff.getState().setHandOffId("h1");
    expect(usePendingHandOff.getState().pending).toEqual({ txId: "t1", amount: 55000, label: "Phở", handOffId: "h1" });
    usePendingHandOff.getState().clear();
    expect(usePendingHandOff.getState().pending).toBeNull();
  });
});
