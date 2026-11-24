import { selectLeftovers } from "../leftovers";

const T = new Date("2026-06-10T12:00:00.000Z");
const ago = (h: number) => new Date(T.getTime() - h * 3600_000).toISOString();
const row = (
  id: string,
  started_at: string,
  over: Partial<{ qr_asset_id: string | null; qr_deleted_at: string | null }> = {},
) => ({
  id,
  started_at,
  qr_asset_id: "asset-" + id,
  qr_deleted_at: null as string | null,
  ...over,
});

describe("selectLeftovers", () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(T);
  });
  afterEach(() => jest.useRealTimers());

  it("returns only hand-offs older than 24h", () => {
    const old = row("a", ago(25));
    expect(selectLeftovers([old, row("b", ago(2))], new Date())).toEqual([old]);
  });

  it("keeps exactly 24h out", () => {
    expect(selectLeftovers([row("a", ago(24))], new Date())).toEqual([]);
  });

  it("skips already-deleted and asset-less rows", () => {
    expect(
      selectLeftovers(
        [row("a", ago(25), { qr_deleted_at: ago(1) }), row("b", ago(25), { qr_asset_id: null })],
        new Date(),
      ),
    ).toEqual([]);
  });

  it("skips unparseable started_at", () => {
    expect(selectLeftovers([row("a", "garbage")], new Date())).toEqual([]);
  });

  it("preserves order and identity", () => {
    const a = row("a", ago(30));
    const b = row("b", ago(26));
    const out = selectLeftovers([a, row("c", ago(1)), b], new Date());
    expect(out[0]).toBe(a);
    expect(out[1]).toBe(b);
    expect(out).toHaveLength(2);
  });
});
