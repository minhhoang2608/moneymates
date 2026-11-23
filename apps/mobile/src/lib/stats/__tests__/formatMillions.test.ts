import { formatMillions } from "../formatMillions";

describe("formatMillions", () => {
  it.each([
    [0, "0"],
    [950_000, "0,95"],
    [8_450_000, "8,45"],
    [6_200_000, "6,2"],
    [25_000_000, "25"],
    [1_004_999, "1"],
  ])("%i -> %s", (v, s) => expect(formatMillions(v)).toBe(s));
});
