import { usePendingHandOff } from "../pendingHandOff";

describe("pendingHandOff", () => {
  beforeEach(() => usePendingHandOff.setState({ pending: null, visible: false }));
  it("hide keeps the pending hand-off, clear drops it", () => {
    const s = usePendingHandOff.getState();
    s.set({ txId: "t", amount: 1, label: "x" });
    s.reveal();
    usePendingHandOff.getState().hide();
    expect(usePendingHandOff.getState()).toMatchObject({ visible: false, pending: { txId: "t" } });
    usePendingHandOff.getState().clear();
    expect(usePendingHandOff.getState().pending).toBeNull();
  });
  it("setReopen and setHandOffId are no-ops without a pending hand-off", () => {
    usePendingHandOff.getState().setHandOffId("h");
    expect(usePendingHandOff.getState().pending).toBeNull();
  });
});
