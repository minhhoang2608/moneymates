import { fadeInProps, motionProps } from "../layout";

describe("motion layout helpers", () => {
  it("returns entering, exiting and layout animations by default", () => {
    const p = motionProps(false);
    expect(p.entering).toBeDefined();
    expect(p.exiting).toBeDefined();
    expect(p.layout).toBeDefined();
    expect(fadeInProps(false).entering).toBeDefined();
  });

  it("returns nothing with reduce motion", () => {
    expect(motionProps(true)).toEqual({});
    expect(fadeInProps(true)).toEqual({});
  });
});
