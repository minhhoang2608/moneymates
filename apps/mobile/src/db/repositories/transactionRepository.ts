import { and, desc, eq, gte, isNotNull, isNull, lt, max, sql } from "drizzle-orm";

import { TransactionError } from "../../lib/transaction/types";
import { nowUtc } from "../columns";
import { newId } from "../ids";
import type { LastUsed } from "../../lib/target/types";
import { category, groups, transactions } from "../schema";
import type { AnyDb } from "../seed";

export type TransactionRow = typeof transactions.$inferSelect;

export type TransactionType = TransactionRow["type"];
export type TransactionSource = TransactionRow["source"];

export type NewTransaction = {
  type: TransactionType;
  /** Integer VND, > 0. */
  amount: number;
  category_id: string;
  note?: string;
  /** Any parseable date; stored as ISO UTC. */
  occurred_at: string;
  money_source?: string;
  photo_uri?: string | null;
  source?: TransactionSource;
  qr_data?: string | null;
};
export type TransactionPatch = Partial<NewTransaction>;

export type TransactionFilter = {
  /** Inclusive ISO UTC lower bound. */
  from?: string;
  /** Exclusive ISO UTC upper bound. Callers pass UTC instants of local month starts. */
  to?: string;
  categoryId?: string;
  type?: TransactionType;
  moneySource?: string;
  /** Case-insensitive (Vietnamese-aware) substring of the note. */
  search?: string;
  /** Only personal rows (`group_id IS NULL`), e.g. for the Tổng quan totals. */
  personalOnly?: boolean;
};

const TYPES = ["expense", "income"];
const SOURCES = ["manual", "qr", "voice", "bill"];

const live = isNull(transactions.deleted_at);

function checkAmount(amount: unknown): number {
  if (typeof amount !== "number" || !Number.isSafeInteger(amount) || amount <= 0) {
    throw new TransactionError("invalid_amount");
  }
  return amount;
}

function checkType(type: unknown): TransactionType {
  if (typeof type !== "string" || !TYPES.includes(type)) throw new TransactionError("invalid_type");
  return type as TransactionType;
}

function checkSource(source: unknown): TransactionSource {
  if (typeof source !== "string" || !SOURCES.includes(source)) throw new TransactionError("invalid_source");
  return source as TransactionSource;
}

function checkOccurredAt(value: unknown): string {
  const ms = typeof value === "string" || typeof value === "number" ? new Date(value).getTime() : NaN;
  if (Number.isNaN(ms)) throw new TransactionError("invalid_occurred_at");
  return new Date(ms).toISOString();
}

export function createTransactionRepository(db: AnyDb) {
  async function getById(id: string): Promise<TransactionRow | null> {
    const rows = await db
      .select()
      .from(transactions)
      .where(and(eq(transactions.id, id), live));
    return rows[0] ?? null;
  }

  async function requireLive(id: string): Promise<TransactionRow> {
    const row = await getById(id);
    if (!row) throw new TransactionError("not_found");
    return row;
  }

  async function checkCategory(id: unknown): Promise<string> {
    if (typeof id !== "string" || id.trim() === "") throw new TransactionError("category_required");
    const rows = await db
      .select({ id: category.id })
      .from(category)
      .where(and(eq(category.id, id), isNull(category.deleted_at)));
    if (rows.length === 0) throw new TransactionError("category_required");
    return id;
  }

  return {
    getById,

    async create(input: NewTransaction): Promise<TransactionRow> {
      const type = checkType(input.type);
      const amount = checkAmount(input.amount);
      const category_id = await checkCategory(input.category_id);
      const occurred_at = checkOccurredAt(input.occurred_at);
      const source = checkSource(input.source ?? "manual");
      const now = nowUtc();
      const id = newId();
      await db.insert(transactions).values({
        id,
        created_at: now,
        updated_at: now,
        type,
        amount,
        currency: "VND",
        category_id,
        note: (input.note ?? "").trim(),
        occurred_at,
        money_source: input.money_source?.trim() || "Tiền mặt",
        photo_uri: input.photo_uri ?? null,
        source,
        qr_data: input.qr_data ?? null,
      });
      return requireLive(id);
    },

    async update(id: string, patch: TransactionPatch): Promise<TransactionRow> {
      await requireLive(id);
      const set: Partial<TransactionRow> = { updated_at: nowUtc() };
      if (patch.type !== undefined) set.type = checkType(patch.type);
      if (patch.amount !== undefined) set.amount = checkAmount(patch.amount);
      if (patch.category_id !== undefined) set.category_id = await checkCategory(patch.category_id);
      if (patch.occurred_at !== undefined) set.occurred_at = checkOccurredAt(patch.occurred_at);
      if (patch.source !== undefined) set.source = checkSource(patch.source);
      if (patch.note !== undefined) set.note = patch.note.trim();
      if (patch.money_source !== undefined) set.money_source = patch.money_source.trim() || "Tiền mặt";
      if (patch.photo_uri !== undefined) set.photo_uri = patch.photo_uri;
      if (patch.qr_data !== undefined) set.qr_data = patch.qr_data;
      await db.update(transactions).set(set).where(eq(transactions.id, id));
      return requireLive(id);
    },

    async softDelete(id: string): Promise<void> {
      await requireLive(id);
      const now = nowUtc();
      await db.update(transactions).set({ deleted_at: now, updated_at: now }).where(eq(transactions.id, id));
    },

    /** Clears `deleted_at` only; every other field stays as it was. */
    async restore(id: string): Promise<TransactionRow> {
      const rows = await db.select().from(transactions).where(eq(transactions.id, id));
      if (rows.length === 0 || rows[0].deleted_at === null) throw new TransactionError("not_found");
      await db.update(transactions).set({ deleted_at: null, updated_at: nowUtc() }).where(eq(transactions.id, id));
      return requireLive(id);
    },

    /** group id → newest `created_at` (when recorded, not the editable `occurred_at`) of its live transactions. */
    async lastRecordedAtByGroup(): Promise<Map<string, string>> {
      const rows = await db
        .select({ group_id: transactions.group_id, last: max(transactions.created_at) })
        .from(transactions)
        .innerJoin(groups, and(eq(groups.id, transactions.group_id), isNull(groups.deleted_at)))
        .where(and(live, isNotNull(transactions.group_id)))
        .groupBy(transactions.group_id);
      const map = new Map<string, string>();
      for (const r of rows) if (r.group_id && r.last) map.set(r.group_id, r.last);
      return map;
    },

    /** Where the newest live transaction went (rows of soft-deleted groups are ignored). Null on an empty DB. */
    async lastUsedTarget(): Promise<LastUsed> {
      const rows = await db
        .select({ group_id: transactions.group_id, at: transactions.created_at })
        .from(transactions)
        .leftJoin(groups, eq(groups.id, transactions.group_id))
        .where(and(live, sql`(${transactions.group_id} is null or ${groups.deleted_at} is null)`))
        .orderBy(desc(transactions.created_at), sql`${transactions}.rowid desc`)
        .limit(1);
      if (rows.length === 0) return null;
      const { group_id, at } = rows[0];
      return { target: group_id === null ? "personal" : { groupId: group_id }, at };
    },

    async list(filter: TransactionFilter = {}): Promise<TransactionRow[]> {
      const conds = [live];
      if (filter.from !== undefined) conds.push(gte(transactions.occurred_at, filter.from));
      if (filter.to !== undefined) conds.push(lt(transactions.occurred_at, filter.to));
      if (filter.categoryId !== undefined) conds.push(eq(transactions.category_id, filter.categoryId));
      if (filter.type !== undefined) conds.push(eq(transactions.type, filter.type));
      if (filter.moneySource !== undefined) conds.push(eq(transactions.money_source, filter.moneySource));
      if (filter.personalOnly) conds.push(isNull(transactions.group_id));
      const rows = await db
        .select()
        .from(transactions)
        .where(and(...conds))
        .orderBy(desc(transactions.occurred_at), desc(transactions.created_at), desc(transactions.id));
      const q = filter.search?.trim().toLocaleLowerCase("vi");
      // SQLite LIKE/lower() don't case-fold Vietnamese diacritics, so match in JS.
      return q ? rows.filter((r) => r.note.toLocaleLowerCase("vi").includes(q)) : rows;
    },
  };
}

export type TransactionRepository = ReturnType<typeof createTransactionRepository>;
