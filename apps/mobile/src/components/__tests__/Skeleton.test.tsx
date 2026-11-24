import { render, screen, waitFor } from "@testing-library/react-native";
import { AccessibilityInfo } from "react-native";
import * as Reanimated from "react-native-reanimated";

import { Skeleton, SkeletonCard, SkeletonList } from "../Skeleton";

describe("Skeleton", () => {
  afterEach(() => jest.restoreAllMocks());

  it("renders a labelled block with the given size", async () => {
    await render(<Skeleton testID="sk" width={80} height={20} radius={6} />);
    const el = screen.getByTestId("sk");
    expect(el.props.accessibilityLabel).toBe("Đang tải");
    expect(el.props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ width: 80, height: 20, borderRadius: 6 })]),
    );
  });

  it("pulses by default", async () => {
    const repeat = jest.spyOn(Reanimated, "withRepeat");
    await render(<Skeleton />);
    expect(repeat).toHaveBeenCalled();
  });

  it("stops pulsing with reduce motion", async () => {
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true);
    const cancel = jest.spyOn(Reanimated, "cancelAnimation");
    await render(<Skeleton />);
    await waitFor(() => expect(cancel).toHaveBeenCalled());
  });

  it("presets render placeholders", async () => {
    await render(
      <>
        <SkeletonList testID="list" count={3} />
        <SkeletonCard testID="card" />
      </>,
    );
    expect(screen.getByTestId("list")).toBeTruthy();
    expect(screen.getByTestId("card")).toBeTruthy();
    expect(screen.getAllByLabelText("Đang tải").length).toBeGreaterThan(3);
  });
});
