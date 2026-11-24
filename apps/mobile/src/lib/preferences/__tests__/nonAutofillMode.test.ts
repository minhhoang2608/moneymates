import { normalizeNonAutofillMode } from "../defaults";

describe("normalizeNonAutofillMode", () => {
  it.each([
    ["qr_image", "qr_image"],
    ["no_image", "no_image"],
    ["paste", "no_image"],
    ["bogus", "qr_image"],
    [42, "qr_image"],
    [null, "qr_image"],
    [undefined, "qr_image"],
  ])("%p -> %p", (input, expected) => {
    expect(normalizeNonAutofillMode(input)).toBe(expected);
  });
});
