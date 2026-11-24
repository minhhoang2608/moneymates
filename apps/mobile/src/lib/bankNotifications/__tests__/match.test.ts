import { matchNotification, MATCH_WINDOW_MS, type MatchableHandOff, type ReceivedNotification } from "../match";

const NOW = Date.UTC(2026, 0, 1, 12, 0, 0);
const MIN = 60 * 1000;
const TPB = "com.tpb.mb.gprsandroid";

const handOff = (o: Partial<MatchableHandOff> = {}): MatchableHandOff => ({
  id: "h1",
  amount: 55000,
  accountNumber: "0001234567",
  message: "PHO HOA BAN 12",
  startedAt: NOW - 3 * MIN,
  ...o,
});
const notif = (o: Partial<ReceivedNotification> = {}): ReceivedNotification => ({
  packageName: TPB,
  direction: "out",
  amount: 55000,
  accountSuffix: "4567",
  message: "PHO HOA BAN 12",
  ...o,
});
const run = (n: ReceivedNotification, h: MatchableHandOff[], enabled = [TPB], now = NOW) =>
  matchNotification({ notification: n, handOffs: h, enabledPackages: enabled, now });

describe("matchNotification", () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(NOW);
  });
  afterEach(() => jest.useRealTimers());

  it("matches amount, account, message within window", () => {
    expect(run(notif(), [handOff()])).toBe("h1");
  });
  it("uses postedAt when present, otherwise now", () => {
    expect(run(notif({ postedAt: NOW - 2 * MIN }), [handOff()])).toBe("h1");
    expect(run(notif({ postedAt: NOW + 60 * MIN }), [handOff()])).toBeNull();
  });
  it("rejects outside window, before start, wrong amount, incoming", () => {
    expect(run(notif(), [handOff({ startedAt: NOW - 40 * MIN })])).toBeNull();
    expect(run(notif(), [handOff({ startedAt: NOW + MIN })])).toBeNull();
    expect(run(notif({ amount: 50000 }), [handOff()])).toBeNull();
    expect(run(notif({ direction: "in" }), [handOff()])).toBeNull();
  });
  it("matches exactly at the window boundary", () => {
    expect(run(notif(), [handOff({ startedAt: NOW - MATCH_WINDOW_MS })])).toBe("h1");
    expect(run(notif(), [handOff({ startedAt: NOW - MATCH_WINDOW_MS - 1 })])).toBeNull();
  });
  it("ignores packages that are not enabled", () => {
    expect(run(notif({ packageName: "com.VCB" }), [handOff()], [TPB])).toBeNull();
  });
  it("checks account suffix and message when present", () => {
    expect(run(notif({ accountSuffix: "9999" }), [handOff()])).toBeNull();
    expect(run(notif({ message: "TRA TIEN NHA" }), [handOff()])).toBeNull();
    expect(run(notif({ accountSuffix: undefined, message: undefined }), [handOff()])).toBe("h1");
    expect(run(notif({ message: "Phở hoà bàn 12" }), [handOff()])).toBe("h1");
    expect(run(notif(), [handOff({ accountNumber: undefined })])).toBeNull();
    expect(run(notif(), [handOff({ message: undefined })])).toBeNull();
  });
  it("picks the most recent unpaid candidate", () => {
    const a = handOff({ id: "a", startedAt: NOW - 10 * MIN });
    const b = handOff({ id: "b", startedAt: NOW - 2 * MIN });
    expect(run(notif(), [a, b])).toBe("b");
    expect(
      run(notif(), [
        handOff({ id: "old", startedAt: NOW - 45 * MIN }),
        handOff({ id: "new", startedAt: NOW - 5 * MIN }),
      ]),
    ).toBe("new");
    expect(run(notif(), [a, handOff({ id: "paid", startedAt: NOW - MIN, paidSignal: "time" })])).toBe("a");
  });
});
