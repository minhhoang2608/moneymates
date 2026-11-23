import { and, asc, eq, isNull } from "drizzle-orm";

import { BankAccountError } from "../../lib/account/types";
import { findBankByBin } from "../../lib/vietqr/banks";
import { nowUtc } from "../columns";
import { newId } from "../ids";
import { bankAccount } from "../schema";
import type { AnyDb } from "../seed";

export type BankAccountRow = typeof bankAccount.$inferSelect;

export type NewBankAccount = { bank_bin: string; bank_name?: string; account_no: string; account_name: string };
export type BankAccountPatch = Partial<NewBankAccount>;

const live = isNull(bankAccount.deleted_at);

export function createBankAccountRepository(db: AnyDb) {
  async function find(id: string): Promise<BankAccountRow> {
    const rows = await db
      .select()
      .from(bankAccount)
      .where(and(eq(bankAccount.id, id), live));
    if (rows.length === 0) throw new BankAccountError("not_found");
    return rows[0];
  }

  function bankFor(bin: string | undefined) {
    const bank = bin ? findBankByBin(bin.trim()) : undefined;
    if (!bank) throw new BankAccountError("bank_required");
    return bank;
  }

  function cleanNo(no: string): string {
    const cleaned = no.replace(/\s+/g, "");
    if (!cleaned) throw new BankAccountError("account_no_required");
    return cleaned;
  }

  async function listAccounts(): Promise<BankAccountRow[]> {
    const rows = await db.select().from(bankAccount).where(live).orderBy(asc(bankAccount.created_at));
    return rows.sort(
      (a, b) =>
        Number(b.is_default) - Number(a.is_default) ||
        a.created_at.localeCompare(b.created_at) ||
        a.id.localeCompare(b.id),
    );
  }

  async function clearDefault(): Promise<void> {
    await db
      .update(bankAccount)
      .set({ is_default: false, updated_at: nowUtc() })
      .where(and(eq(bankAccount.is_default, true), live));
  }

  return {
    listAccounts,

    async addAccount(input: NewBankAccount): Promise<BankAccountRow> {
      const bank = bankFor(input.bank_bin);
      const account_no = cleanNo(input.account_no);
      const hasLive = (await listAccounts()).length > 0;
      const now = nowUtc();
      const id = newId();
      await db.insert(bankAccount).values({
        id,
        created_at: now,
        updated_at: now,
        bank_bin: bank.bin,
        bank_name: input.bank_name?.trim() || bank.shortName,
        account_no,
        account_name: input.account_name.trim(),
        is_default: !hasLive,
      });
      return find(id);
    },

    /** Same validation as add. `is_default` can only change through `setDefault`. */
    async updateAccount(id: string, patch: BankAccountPatch): Promise<BankAccountRow> {
      const current = await find(id);
      const set: Partial<BankAccountRow> = { updated_at: nowUtc() };
      if (patch.bank_bin !== undefined) {
        const bank = bankFor(patch.bank_bin);
        set.bank_bin = bank.bin;
        if (patch.bank_name === undefined && bank.bin !== current.bank_bin) set.bank_name = bank.shortName;
      }
      if (patch.bank_name !== undefined)
        set.bank_name = patch.bank_name.trim() || bankFor(set.bank_bin ?? current.bank_bin).shortName;
      if (patch.account_no !== undefined) set.account_no = cleanNo(patch.account_no);
      if (patch.account_name !== undefined) set.account_name = patch.account_name.trim();
      await db.update(bankAccount).set(set).where(eq(bankAccount.id, id));
      return find(id);
    },

    /** Soft delete. Deleting the default promotes the oldest remaining account. */
    async deleteAccount(id: string): Promise<void> {
      const current = await find(id);
      const now = nowUtc();
      await db
        .update(bankAccount)
        .set({ deleted_at: now, updated_at: now, is_default: false })
        .where(eq(bankAccount.id, id));
      if (current.is_default) {
        const rest = await listAccounts();
        if (rest.length > 0) {
          await db
            .update(bankAccount)
            .set({ is_default: true, updated_at: nowUtc() })
            .where(eq(bankAccount.id, rest[0].id));
        }
      }
    },

    async setDefault(id: string): Promise<BankAccountRow> {
      const current = await find(id);
      if (current.is_default) return current;
      await clearDefault();
      await db.update(bankAccount).set({ is_default: true, updated_at: nowUtc() }).where(eq(bankAccount.id, id));
      return find(id);
    },

    async getDefaultAccount(): Promise<BankAccountRow | null> {
      const rows = await db
        .select()
        .from(bankAccount)
        .where(and(eq(bankAccount.is_default, true), live));
      return rows[0] ?? null;
    },
  };
}

export type BankAccountRepository = ReturnType<typeof createBankAccountRepository>;
