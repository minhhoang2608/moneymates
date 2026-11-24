import { and, asc, eq, isNotNull, isNull } from "drizzle-orm";

import { evaluateReturn } from "../../lib/payConfirm/paidRule";
import { nowUtc } from "../columns";
import { newId } from "../ids";
import { handOffs, type HandOffMethod, type HandOffRow, type PaidSignal } from "../schema";
import type { AnyDb } from "../seed";
import { createHandOffMemoryRepository } from "./handOffMemoryRepository";

export type NewHandOff = { transaction_id: string; app_id: string; method: HandOffMethod; started_at: Date };

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
