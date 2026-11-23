import { alertLevel } from "../alert";

describe("alertLevel", () => {
  test.each([
    [12_500_000, 10_000_000, "up"],
    [11_000_000, 10_000_000, "none"],
    [12_000_000, 10_000_000, "none"],
    [7_500_000, 10_000_000, "down"],
    [8_000_000, 10_000_000, "none"],
    [500_000, 0, "none"],
    [0, 0, "none"],
  ])("%d vs %d -> %s", (a, b, out) => expect(alertLevel(a, b)).toBe(out));
});
