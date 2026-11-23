import { moveItem, targetIndex } from "../reorder";

describe("moveItem", () => {
  const list = ["a", "b", "c", "d"];
  it("moves up and down", () => {
    expect(moveItem(list, 2, 0)).toEqual(["c", "a", "b", "d"]);
    expect(moveItem(list, 0, 2)).toEqual(["b", "c", "a", "d"]);
  });
  it("is a no-op for same or invalid index and does not mutate", () => {
    expect(moveItem(list, 1, 1)).toEqual(list);
    expect(moveItem(list, 9, 0)).toEqual(list);
    expect(list).toEqual(["a", "b", "c", "d"]);
  });
  it("clamps the target", () => {
    expect(moveItem(list, 1, -5)).toEqual(["b", "a", "c", "d"]);
    expect(moveItem(list, 1, 99)).toEqual(["a", "c", "d", "b"]);
  });
});

describe("targetIndex", () => {
  it("rounds dy to rows and clamps", () => {
    expect(targetIndex(2, -104, 52, 5)).toBe(0);
    expect(targetIndex(2, 30, 52, 5)).toBe(3);
    expect(targetIndex(2, 10, 52, 5)).toBe(2);
    expect(targetIndex(1, -500, 52, 5)).toBe(0);
    expect(targetIndex(3, 500, 52, 5)).toBe(4);
  });
});
