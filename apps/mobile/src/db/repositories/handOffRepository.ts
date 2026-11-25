import { and, asc, eq, gte, isNotNull, isNull, ne, or } from "drizzle-orm";

import { evaluateReturn } from "../../lib/payConfirm/paidRule";
import { nowUtc } from "../columns";
import { newId } from "../ids";
import { handOffs, transactions, type HandOffMethod, type HandOffRow, type PaidSignal } from "../schema";
import type { AnyDb } from "../seed";
import { createHandOffMemoryRepository } from "./handOffMemoryRepository";

export type NewHandOff = { transaction_id: string; app_id: string; method: HandOffMethod; started_at: Date };

export type ReceiptCandidate = { handOff: HandOffRow; amount: number; qr_data: string | null };

export function createHandOffRepository(db: AnyDb) {
  const memory = createHandOffMemoryRepository(db);

  async function get(id: string): Promise<HandOffRow | null> {
    const rows = await db
      .select()
      .from(handOffs)
      .where(and(eq(handOffs.id, id), isNull(handOffs.deleted_at)))
      .limit(1);
    return rows[0] ?? null;
  }

  /** Sets the paid signal only if none is set yet. Returns whether this call set it. */
  async function markPaid(id: string, signal: PaidSignal): Promise<boolean> {
    const row = await get(id);
    if (!row || row.paid_signal) return false;
    await db
      .update(handOffs)
      .set({ paid_signal: signal, updated_at: nowUtc() })
      .where(and(eq(handOffs.id, id), isNull(handOffs.paid_signal)));
    if (row.method === "share") await memory.setShareResult(row.app_id, true);
    return true;
  }

  return {
    get,
    markPaid,

    /** Remembers which saved QR image (media-library asset) belongs to this hand-off. */
    async setQrAsset(id: string, assetId: string): Promise<HandOffRow | null> {
      if (!(await get(id))) return null;
      await db.update(handOffs).set({ qr_asset_id: assetId, updated_at: nowUtc() }).where(eq(handOffs.id, id));
      return get(id);
    },

    /** Attaches a receipt image to the hand-off. Does not touch `paid_signal`. */
    async attachReceipt(id: string, uri: string): Promise<HandOffRow | null> {
      if (!(await get(id))) return null;
      await db.update(handOffs).set({ receipt_uri: uri, updated_at: nowUtc() }).where(eq(handOffs.id, id));
      return get(id);
    },

    /** Removes the receipt image from the hand-off. */
    async detachReceipt(id: string): Promise<HandOffRow | null> {
      if (!(await get(id))) return null;
      await db.update(handOffs).set({ receipt_uri: null, updated_at: nowUtc() }).where(eq(handOffs.id, id));
      return get(id);
    },

    /** Sets `paid_signal` back to null, only when it still equals `signal`. */
    async clearPaidSignal(id: string, signal: PaidSignal): Promise<void> {
      await db
        .update(handOffs)
        .set({ paid_signal: null, updated_at: nowUtc() })
        .where(and(eq(handOffs.id, id), eq(handOffs.paid_signal, signal)));
    },

    /** Live hand-offs started at or after `since` that no receipt has confirmed yet, with their transaction data. */
    async listReceiptCandidates(since: Date): Promise<ReceiptCandidate[]> {
      const rows = await db
        .select({ handOff: handOffs, amount: transactions.amount, qr_data: transactions.qr_data })
        .from(handOffs)
        .innerJoin(transactions, eq(handOffs.transaction_id, transactions.id))
        .where(
          and(
            isNull(handOffs.deleted_at),
            isNull(transactions.deleted_at),
            gte(handOffs.started_at, since.toISOString()),
            or(isNull(handOffs.paid_signal), ne(handOffs.paid_signal, "receipt")),
          ),
        );
      return rows;
    },

    /** Stamps the time the QR image was deleted. The first deletion time wins. */
    async markQrDeleted(id: string, at: Date = new Date()): Promise<HandOffRow | null> {
      if (!(await get(id))) return null;
      await db
        .update(handOffs)
        .set({ qr_deleted_at: at.toISOString(), updated_at: nowUtc() })
        .where(and(eq(handOffs.id, id), isNull(handOffs.qr_deleted_at)));
      return get(id);
    },

    /** Hand-offs whose QR image was saved and not yet deleted, oldest first. */
    async listPendingQrImages(): Promise<HandOffRow[]> {
      return db
        .select()
        .from(handOffs)
        .where(and(isNotNull(handOffs.qr_asset_id), isNull(handOffs.qr_deleted_at), isNull(handOffs.deleted_at)))
        .orderBy(asc(handOffs.started_at));
    },

    async create(input: NewHandOff): Promise<HandOffRow> {
      const now = nowUtc();
      const id = newId();
      await db.insert(handOffs).values({
        id,
        created_at: now,
        updated_at: now,
        transaction_id: input.transaction_id,
        app_id: input.app_id,
        method: input.method,
        started_at: input.started_at.toISOString(),
      });
      return (await get(id)) as HandOffRow;
    },

    /** The user is back in the app: stamp `returned_at` and apply the 60-second rule. */
    async recordReturn(id: string, now: Date = new Date()): Promise<HandOffRow | null> {
      const row = await get(id);
      if (!row) return null;
      const ev = evaluateReturn(row, now);
      await db.update(handOffs).set({ returned_at: ev.returned_at, updated_at: nowUtc() }).where(eq(handOffs.id, id));
      if (ev.paid_signal && !row.paid_signal) await markPaid(id, ev.paid_signal);
      return get(id);
    },
  };
}

export type HandOffRepository = ReturnType<typeof createHandOffRepository>;
