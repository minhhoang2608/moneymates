import { fireEvent, render, screen } from "@testing-library/react-native";

import { CoachSheet } from "../CoachSheet";

describe("CoachSheet", () => {
  it("shows the instruction for the bank", async () => {
    await render(<CoachSheet bankName="Techcombank" onConfirm={jest.fn()} onClose={jest.fn()} />);
    expect(screen.getByTestId("coach-text")).toHaveTextContent(
      "Trong Techcombank: bấm Quét QR → biểu tượng Ảnh → chọn ảnh đầu tiên",
    );
  });
  it("confirm passes the checkbox state", async () => {
    const onConfirm = jest.fn();
    await render(<CoachSheet bankName="Techcombank" onConfirm={onConfirm} onClose={jest.fn()} />);
    expect(screen.getByTestId("coach-dont-show").props.accessibilityState.checked).toBe(false);
    await fireEvent.press(screen.getByTestId("coach-confirm"));
    expect(onConfirm).toHaveBeenLastCalledWith({ dontShow: false });
    await fireEvent.press(screen.getByTestId("coach-dont-show"));
    expect(screen.getByTestId("coach-dont-show").props.accessibilityState.checked).toBe(true);
    await fireEvent.press(screen.getByTestId("coach-confirm"));
    expect(onConfirm).toHaveBeenLastCalledWith({ dontShow: true });
  });
  it("close cancels", async () => {
    const onConfirm = jest.fn();
    const onClose = jest.fn();
    await render(<CoachSheet bankName="Techcombank" onConfirm={onConfirm} onClose={onClose} />);
    await fireEvent.press(screen.getByTestId("coach-close"));
    expect(onClose).toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
