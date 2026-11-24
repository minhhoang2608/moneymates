import { evaluateReturn, methodFromResult, PAID_AFTER_MS } from "../paidRule";

const start = "2026-01-01T10:00:00.000Z";
const at = (ms: number) => new Date(new Date(start).getTime() + ms);

describe("evaluateReturn", () => {
  it("marks time after 75 s", () => {
    expect(evaluateReturn({ started_at: start, paid_signal: null }, at(75_000)).paid_signal).toBe("time");
  });
  it("leaves 20 s unpaid", () => {
    const r = evaluateReturn({ started_at: start, paid_signal: null }, at(20_000));
    expect(r.paid_signal).toBeNull();
    expect(r.returned_at).toBe(at(20_000).toISOString());
  });
  it("has an exact 60 s boundary", () => {
    expect(evaluateReturn({ started_at: start, paid_signal: null }, at(PAID_AFTER_MS - 1)).paid_signal).toBeNull();
    expect(evaluateReturn({ started_at: start, paid_signal: null }, at(PAID_AFTER_MS)).paid_signal).toBe("time");
  });
  it("keeps an earlier signal", () => {
    expect(evaluateReturn({ started_at: start, paid_signal: "notification" }, at(90_000)).paid_signal).toBe(
      "notification",
    );
  });
});

describe("methodFromResult", () => {
  it("maps results", () => {
    expect(methodFromResult({ mode: "autofill", decision: "autofill-link" })).toBe("autofill");
    expect(methodFromResult({ mode: "direct", decision: "direct-share", share: "shared" })).toBe("share");
    expect(methodFromResult({ mode: "direct", decision: "direct-share", share: "share_failed" })).toBe("paste");
    expect(methodFromResult({ mode: "direct", decision: "open-only" })).toBe("paste");
  });
});
