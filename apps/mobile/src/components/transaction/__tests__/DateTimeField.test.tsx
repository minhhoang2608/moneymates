import { fireEvent, render } from "@testing-library/react-native";

import { DateTimeField } from "../DateTimeField";

describe("DateTimeField dateOnly", () => {
  it("calls onChange once with the picked day then onClose, with no time step", async () => {
    const onChange = jest.fn();
    const onClose = jest.fn();
    const view = await render(
      <DateTimeField dateOnly value={new Date(2026, 0, 1, 12)} onChange={onChange} onClose={onClose} />,
    );
    await fireEvent(view.getByTestId("datetime-picker"), "onChange", { type: "set" }, new Date(2026, 11, 4, 8));
    expect(onChange).toHaveBeenCalledTimes(1);
    const d: Date = onChange.mock.calls[0][0];
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]).toEqual([2026, 11, 4, 12]);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(view.getByTestId("datetime-picker").props.mode).toBe("date");
  });
});
