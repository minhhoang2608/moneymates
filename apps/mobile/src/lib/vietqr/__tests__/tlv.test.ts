import { decodeTlv, encodeTlv, encodeTlvList } from "../tlv";

describe("tlv", () => {
  it("encodes id, padded length and value", () => {
    expect(encodeTlv("00", "01")).toBe("000201");
    expect(encodeTlv("59", "A".repeat(10))).toBe("5910AAAAAAAAAA");
    expect(encodeTlv("62", "")).toBe("6200");
  });
  it("encodes nested templates", () => {
    const inner = encodeTlvList([
      ["00", "AB"],
      ["01", "123"],
    ]);
    expect(inner).toBe("0002AB0103123");
    expect(encodeTlv("38", inner)).toBe("3813" + inner);
  });
  it("throws on bad id or too long value", () => {
    expect(() => encodeTlv("1", "x")).toThrow(RangeError);
    expect(() => encodeTlv("ab", "x")).toThrow(RangeError);
    expect(() => encodeTlv("00", "x".repeat(100))).toThrow(RangeError);
    expect(encodeTlv("00", "x".repeat(99))).toHaveLength(103);
  });
});

describe("decodeTlv", () => {
  it("decodes flat fields, empty values and nesting", () => {
    const r = decodeTlv("0002016200" + "0504abcd");
    expect(r).toEqual({
      ok: true,
      fields: new Map([
        ["00", "01"],
        ["62", ""],
        ["05", "abcd"],
      ]),
    });
  });
  it("fails on length overrun and non-numeric id/length", () => {
    expect(decodeTlv("0005ab")).toEqual({ ok: false });
    expect(decodeTlv("AB02xx")).toEqual({ ok: false });
    expect(decodeTlv("000x01")).toEqual({ ok: false });
    expect(decodeTlv("00")).toEqual({ ok: false });
  });
});
