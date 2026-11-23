import { loadGoldenFixtures } from "../../../../golden/loadFixtures";
import {
  computeBalances,
  formatSettlementItem,
  settlementList,
  type GroupExpense,
  type SettleMember,
  type SettlementPayment,
} from "..";

const members: SettleMember[] = [
  { id: "me", name: "Tôi", isMe: true },
  { id: "an", name: "An" },
  { id: "binh", name: "Bình" },
];
const nameOf = (id: string) => members.find((m) => m.id === id)!.name;
const equal: GroupExpense = { paidBy: "me", amount: 900000, shares: { me: 300000, an: 300000, binh: 300000 } };
const bal = (e: GroupExpense[], p?: SettlementPayment[]) => computeBalances({ members, expenses: e, payments: p });
const lines = (e: GroupExpense[], p?: SettlementPayment[]) =>
  settlementList(members, bal(e, p)).map((i) => formatSettlementItem(i, nameOf));

describe("computeBalances", () => {
  it("Tôi pays, Bình pays part", () => {
    const e: GroupExpense[] = [
      { paidBy: "me", amount: 900000, shares: { me: 400000, an: 400000, binh: 100000 } },
      { paidBy: "binh", amount: 300000, shares: { binh: 300000 } },
    ];
    const r = bal(e);
    expect(r.map((x) => [x.paid, x.owed, x.balance])).toEqual([
      [900000, 400000, 500000],
      [0, 400000, -400000],
      [300000, 400000, -100000],
    ]);
  });
  it("paid payment settles, unpaid ignored", () => {
    const e: GroupExpense = { paidBy: "me", amount: 900000, shares: { me: 400000, an: 400000, binh: 100000 } };
    const pay = { from: "an", to: "me", amount: 400000 };
    const unpaid = bal([e], [{ ...pay, paidAt: null }]);
    expect(unpaid.map((x) => x.balance)).toEqual([500000, -400000, -100000]);
    expect(lines([e], [{ ...pay, paidAt: null }])).toEqual(["An trả Tôi 400.000đ", "Bình trả Tôi 100.000đ"]);
    const paid = [{ ...pay, paidAt: "2026-01-01T00:00:00Z" }];
    expect(bal([e], paid).map((x) => x.balance)).toEqual([100000, 0, -100000]);
    expect(lines([e], paid)).toEqual(["Bình trả Tôi 100.000đ"]);
  });
  it("empty group", () => {
    expect(bal([]).every((x) => x.paid === 0 && x.owed === 0 && x.balance === 0)).toBe(true);
    expect(lines([])).toEqual([]);
  });
  it("throws on bad input", () => {
    expect(() => bal([{ paidBy: "zed", amount: 1, shares: { me: 1 } }])).toThrow(RangeError);
    expect(() => bal([{ paidBy: "me", amount: 1, shares: { zed: 1 } }])).toThrow(RangeError);
    expect(() => bal([{ paidBy: "me", amount: 1.5, shares: { me: 1.5 } }])).toThrow(RangeError);
    expect(() => settlementList([{ id: "a", name: "A" }], [])).toThrow(RangeError);
  });
});

describe("settlementList", () => {
  it("lists transfers to Tôi", () => {
    expect(lines([equal])).toEqual(["An trả Tôi 300.000đ", "Bình trả Tôi 300.000đ"]);
    const e: GroupExpense = { paidBy: "me", amount: 900000, shares: { me: 400000, an: 400000, binh: 100000 } };
    const f: GroupExpense = { paidBy: "binh", amount: 300000, shares: { binh: 300000 } };
    expect(lines([e, f])).toEqual(["An trả Tôi 400.000đ", "Bình trả Tôi 100.000đ"]);
  });
  it("Tôi pays Bình when Bình fronted money", () => {
    const e: GroupExpense = { paidBy: "binh", amount: 600000, shares: { me: 200000, an: 400000 } };
    expect(lines([e])).toEqual(["An trả Tôi 400.000đ", "Tôi trả Bình 600.000đ"]);
  });
  it("equal split when only Bình paid", () => {
    const e: GroupExpense = { paidBy: "binh", amount: 600000, shares: { me: 200000, an: 200000, binh: 200000 } };
    expect(lines([e])).toEqual(["An trả Tôi 200.000đ", "Tôi trả Bình 400.000đ"]);
  });
});

describe("property: applying the list settles everything", () => {
  const scenarios: { members: SettleMember[]; expenses: GroupExpense[]; payments: SettlementPayment[] }[] = [
    { members, expenses: [equal], payments: [] },
  ];
  for (const f of loadGoldenFixtures().filter((x) => x.domain === "settlement")) {
    const i = f.input as {
      members: { name: string; is_me?: boolean }[];
      expenses: { paid_by: string; amount: number; splits: Record<string, number> }[];
      settlements?: { from: string; to: string; amount: number; paid?: boolean }[];
    };
    scenarios.push({
      members: i.members.map((m) => ({ id: m.name, name: m.name, isMe: m.is_me })),
      expenses: i.expenses.map((e) => ({ paidBy: e.paid_by, amount: e.amount, shares: e.splits })),
      payments: (i.settlements ?? []).map((s) => ({ ...s, paidAt: s.paid ? "2026-01-01T00:00:00Z" : null })),
    });
  }
  it.each(scenarios.map((s, n) => [n, s] as const))("scenario %i", (_n, s) => {
    const b = computeBalances(s);
    expect(b.reduce((a, x) => a + x.balance, 0)).toBe(0);
    const list = settlementList(s.members, b);
    const after = computeBalances({
      members: s.members,
      expenses: s.expenses,
      payments: [...s.payments, ...list.map((x) => ({ ...x, paidAt: "2026-02-01T00:00:00Z" }))],
    });
    expect(after.every((x) => x.balance === 0)).toBe(true);
    expect(settlementList(s.members, after)).toEqual([]);
  });
});
