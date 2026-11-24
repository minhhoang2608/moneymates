import { formatCompactVnd } from "../formatCompactVnd";

describe("formatCompactVnd", () => {
  it.each([
    [3_200_000, "3,2tr"],
    [1_450_000, "1,45tr"],
    [950_000, "0,95tr"],
    [25_000_000, "25tr"],
    [5_000, "5.000đ"],
  ])("%i -> %s", (v, s) => expect(formatCompactVnd(v)).toBe(s));
});
