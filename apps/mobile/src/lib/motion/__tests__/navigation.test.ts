import { stackScreenOptions, toastMotionProps } from "../navigation";

describe("navigation motion", () => {
  it("AC3: stack slides from the right", () => {
    expect(stackScreenOptions(false).animation).toBe("slide_from_right");
  });
  it("AC2: toasts get entering and exiting animations", () => {
    const p = toastMotionProps(false);
    expect(p.entering).toBeDefined();
    expect(p.exiting).toBeDefined();
  });
  it("AC4: reduce motion disables transitions and toast animation", () => {
    expect(stackScreenOptions(true).animation).toBe("none");
    expect(toastMotionProps(true)).toEqual({});
  });
});
