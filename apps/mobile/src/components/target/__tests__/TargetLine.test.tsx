import { fireEvent, render, screen } from "@testing-library/react-native";

import type { Target } from "@/lib/target";
import { grp, hoursAgo, NOW } from "@/lib/target/testFixtures";

import { TargetLine } from "../TargetLine";

const groups = [grp("dalat", "Đà Lạt 12/2026"), grp("antrua", "Ăn trưa văn phòng")];
const dalat: Target = { kind: "group", groupId: "dalat", name: "Đà Lạt 12/2026", icon: "🏖️", ended: false };

const setup = async (value: Target, onChange = jest.fn()) => {
  await render(
    <TargetLine
      value={value}
      onChange={onChange}
      groups={groups}
      lastUsedByGroup={new Map([["dalat", hoursAgo(2)]])}
      now={NOW}
    />,
  );
  return onChange;
};

describe("TargetLine", () => {
  it("shows the group name and opens the sheet; picking calls onChange once and closes", async () => {
    const onChange = await setup(dalat);
    expect(screen.getByText("Đà Lạt 12/2026 ›")).toBeTruthy();
    expect(screen.getByLabelText("Ghi vào: Đà Lạt 12/2026 ›")).toBeTruthy();
    expect(screen.queryByTestId("target-sheet")).toBeNull();
    await fireEvent.press(screen.getByTestId("target-line"));
    expect(screen.getByTestId("target-sheet")).toBeTruthy();
    await fireEvent.press(screen.getByTestId("target-row-antrua"));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ kind: "group", groupId: "antrua" }));
    expect(screen.queryByTestId("target-sheet")).toBeNull();
  });

  it("closing without a choice does not call onChange", async () => {
    const onChange = await setup(dalat);
    await fireEvent.press(screen.getByTestId("target-line"));
    await fireEvent.press(screen.getByTestId("target-close"));
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByTestId("target-sheet")).toBeNull();
  });

  it("personal shows Cá nhân ›", async () => {
    await setup({ kind: "personal" });
    expect(screen.getByText("Cá nhân ›")).toBeTruthy();
  });
});
