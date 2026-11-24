import { emitE2eNotification, e2eSubscribe, e2eIsAccessGranted, setE2eAccessGranted } from "../notificationListener";

const ev = (packageName: string) => ({ packageName, title: "t", text: "x", postedAt: 1 });

describe("e2e notification listener", () => {
  it("delivers to allowed subscribers only and stops after unsubscribe", () => {
    const h = jest.fn();
    const un = e2eSubscribe(h, ["a"]);
    emitE2eNotification(ev("b"));
    expect(h).not.toHaveBeenCalled();
    emitE2eNotification(ev("a"));
    expect(h).toHaveBeenCalledTimes(1);
    un();
    emitE2eNotification(ev("a"));
    expect(h).toHaveBeenCalledTimes(1);
  });
  it("access defaults to false and is settable", async () => {
    expect(await e2eIsAccessGranted()).toBe(false);
    setE2eAccessGranted(true);
    expect(await e2eIsAccessGranted()).toBe(true);
    setE2eAccessGranted(false);
  });
});
