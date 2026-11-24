import { usePendingHandOff } from "../pendingHandOff";

describe("pendingHandOff askPaid", () => {
  beforeEach(() => usePendingHandOff.setState({ pending: null, visible: false }));
  it("askPaid sets the question, answerPaid clears it", () => {
    const s = usePendingHandOff.getState();
    s.set({ txId: "t", amount: 1, label: "x" });
    s.askPaid("tcb");
    expect(usePendingHandOff.getState().pending).toMatchObject({ askPaid: true, appId: "tcb" });
    usePendingHandOff.getState().answerPaid();
    expect(usePendingHandOff.getState().pending?.askPaid).toBe(false);
  });
  it("is a no-op without a pending hand-off", () => {
    usePendingHandOff.getState().askPaid("tcb");
    expect(usePendingHandOff.getState().pending).toBeNull();
  });
});
