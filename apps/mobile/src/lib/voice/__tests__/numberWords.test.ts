import { parseNumberWords } from "../numberWords";

const run = (s: string) => parseNumberWords(s.split(/\s+/).filter(Boolean));

describe("parseNumberWords", () => {
  it.each([
    ["năm mươi nghìn", 50_000],
    ["hai mươi lăm nghìn", 25_000],
    ["một trăm linh năm nghìn", 105_000],
    ["mười lăm nghìn", 15_000],
    ["một triệu rưỡi", 1_500_000],
    ["hai triệu ba trăm nghìn", 2_300_000],
    ["ba trăm ngàn", 300_000],
    ["hai tỷ", 2_000_000_000],
    ["hai trăm rưỡi nghìn", 250_000],
    ["hai trăm nghìn", 200_000],
    ["nam muoi nghin", 50_000],
  ])("%s → %d", (s, vnd) => {
    const r = run(s);
    expect(r?.vnd).toBe(vnd);
    expect(r?.consumed).toBe(s.split(" ").length);
    expect(Number.isInteger(r?.vnd)).toBe(true);
  });

  it.each([["trăm hai"], [""], ["hai trăm"], ["nghìn"], ["phở"]])("%j → null", (s) => {
    expect(run(s)).toBeNull();
  });

  it("stops at the first non-number word", () => {
    expect(run("năm mươi nghìn với ba")).toEqual({ vnd: 50_000, consumed: 3 });
  });
});
