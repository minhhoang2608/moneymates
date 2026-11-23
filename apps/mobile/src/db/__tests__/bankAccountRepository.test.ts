import { eq } from "drizzle-orm";

import { BankAccountError } from "../../lib/account/types";
import { createBankAccountRepository } from "../repositories";
import { bankAccount } from "../schema";
import type { AnyDb } from "../seed";
import { openTestDb } from "../testing/testDb";

const original = global.fetch;
const fetchMock = jest.fn(() => {
  throw new Error("network disabled");
});
beforeAll(() => {
  global.fetch = fetchMock as unknown as typeof fetch;
});
afterAll(() => {
  global.fetch = original;
  expect(fetchMock).not.toHaveBeenCalled(); // AC6
});

const setup = () => {
  const { db, sqlite } = openTestDb();
  return { db, sqlite, repo: createBankAccountRepository(db as unknown as AnyDb) };
};
const tp = { bank_bin: "970423", account_no: "0123456789", account_name: "LE MINH HOANG" };
const vcb = { bank_bin: "970436", account_no: "999", account_name: "A" };
const tick = () => new Promise((r) => setTimeout(r, 3));
const code = async (p: Promise<unknown>) => {
  try {
    await p;
  } catch (e) {
    return (e as BankAccountError).code;
  }
  return null;
};

describe("bank account repository", () => {
  it("AC2: first account becomes default with bank name from BIN", async () => {
    const { repo } = setup();
    const a = await repo.addAccount(tp);
    expect(a.is_default).toBe(true);
    expect(a.bank_name).toBe("TPBank");
    expect((await repo.getDefaultAccount())?.id).toBe(a.id);
    expect(await repo.listAccounts()).toHaveLength(1);
  });

  it("second account is not default; list puts default first", async () => {
    const { repo } = setup();
    const a = await repo.addAccount(tp);
    await tick();
    const b = await repo.addAccount(vcb);
    expect(b.is_default).toBe(false);
    expect((await repo.listAccounts()).map((r) => r.id)).toEqual([a.id, b.id]);
    await repo.setDefault(b.id);
    expect((await repo.listAccounts()).map((r) => r.id)).toEqual([b.id, a.id]);
  });

  it("AC3: setDefault leaves exactly one default; index blocks a second", async () => {
    const { repo, db } = setup();
    const a = await repo.addAccount(tp);
    await tick();
    const b = await repo.addAccount(vcb);
    await repo.setDefault(b.id);
    const defaults = (await repo.listAccounts()).filter((r) => r.is_default);
    expect(defaults.map((r) => r.id)).toEqual([b.id]);
    await repo.setDefault(b.id);
    expect((await repo.getDefaultAccount())?.id).toBe(b.id);
    expect(() => db.update(bankAccount).set({ is_default: true }).where(eq(bankAccount.id, a.id)).run()).toThrow();
  });

  it("AC4: deleting the default promotes the oldest remaining; soft delete", async () => {
    const { repo, db } = setup();
    const a = await repo.addAccount(tp);
    await tick();
    const b = await repo.addAccount(vcb);
    await repo.deleteAccount(a.id);
    expect((await repo.getDefaultAccount())?.id).toBe(b.id);
    const raw = db.select().from(bankAccount).where(eq(bankAccount.id, a.id)).all()[0];
    expect(raw.deleted_at).not.toBeNull();
    await repo.deleteAccount(b.id);
    expect(await repo.getDefaultAccount()).toBeNull();
    expect(await repo.listAccounts()).toEqual([]);
  });

  it("deleting a non-default leaves the default; a new account after total delete is default", async () => {
    const { repo } = setup();
    const a = await repo.addAccount(tp);
    await tick();
    const b = await repo.addAccount(vcb);
    await repo.deleteAccount(b.id);
    expect((await repo.getDefaultAccount())?.id).toBe(a.id);
    await repo.deleteAccount(a.id);
    expect((await repo.addAccount(vcb)).is_default).toBe(true);
  });

  it("AC5: invalid input is rejected and nothing is inserted", async () => {
    const { repo } = setup();
    expect(await code(repo.addAccount({ ...tp, bank_bin: "" }))).toBe("bank_required");
    expect(await code(repo.addAccount({ ...tp, bank_bin: "000000" }))).toBe("bank_required");
    expect(await code(repo.addAccount({ ...tp, account_no: "" }))).toBe("account_no_required");
    expect(await code(repo.addAccount({ ...tp, account_no: "   " }))).toBe("account_no_required");
    expect(await repo.listAccounts()).toEqual([]);
    const a = await repo.addAccount(tp);
    expect(await code(repo.updateAccount(a.id, { account_no: " " }))).toBe("account_no_required");
    expect(await code(repo.updateAccount(a.id, { bank_bin: "1" }))).toBe("bank_required");
    expect((await repo.listAccounts())[0].account_no).toBe("0123456789");
  });

  it("strips whitespace from account_no and trims name; update works", async () => {
    const { repo } = setup();
    const a = await repo.addAccount({ ...tp, account_no: " 0123 456 789 ", account_name: "  X  " });
    expect(a.account_no).toBe("0123456789");
    expect(a.account_name).toBe("X");
    await tick();
    const u = await repo.updateAccount(a.id, { bank_bin: "970436", account_name: "Y" });
    expect(u.bank_name).toBe("Vietcombank");
    expect(u.account_name).toBe("Y");
    expect(u.is_default).toBe(true);
    expect(u.updated_at > a.updated_at).toBe(true);
  });

  it("not_found for unknown or deleted ids", async () => {
    const { repo } = setup();
    expect(await code(repo.setDefault("nope"))).toBe("not_found");
    const a = await repo.addAccount(tp);
    await repo.deleteAccount(a.id);
    expect(await code(repo.deleteAccount(a.id))).toBe("not_found");
    expect(await code(repo.updateAccount(a.id, { account_name: "z" }))).toBe("not_found");
  });
});
