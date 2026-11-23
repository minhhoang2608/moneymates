import type { CategoryRow } from "@/db/repositories";

import { aiText, pickInitialCategory } from "../category";

const row = (id: string, name: string) => ({ id, name }) as CategoryRow;
const rows = [row("a", "Ăn uống"), row("b", "Di chuyển"), row("o", "Khác")];

describe("pickInitialCategory", () => {
  it("AC1: PHO 24 → Ăn uống", () => {
    expect(pickInitialCategory(rows, "NGUYEN VAN A", "PHO 24")).toEqual({ id: "a", source: "keyword" });
  });
  it("AC2: GRAB 123456 → Di chuyển, CAFE SANG → Ăn uống", () => {
    expect(pickInitialCategory(rows, null, "GRAB 123456").id).toBe("b");
    expect(pickInitialCategory(rows, null, "CAFE SANG").id).toBe("a");
  });
  it("no keyword → Khác fallback", () => {
    expect(pickInitialCategory(rows, "NGUYEN VAN A", undefined)).toEqual({ id: "o", source: "fallback" });
  });
});

describe("aiText", () => {
  it("joins message and name, trimmed", () => {
    expect(aiText("NGUYEN VAN A", "tien nha")).toBe("tien nha NGUYEN VAN A");
    expect(aiText(undefined, undefined)).toBe("");
    expect(aiText("A", undefined)).toBe("A");
  });
});
