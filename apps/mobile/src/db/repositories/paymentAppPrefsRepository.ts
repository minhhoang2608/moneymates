import { asc, isNull } from "drizzle-orm";

import { FEATURED_APP_IDS, normalizeAppId } from "../../lib/payConfirm/apps";
import { nowUtc } from "../columns";
import { newId } from "../ids";
import { paymentAppPrefs } from "../schema";
import type { AnyDb } from "../seed";

type SyncTxDb = { transaction: (fn: (tx: any) => void) => void };

const catalogueIds = () => [...FEATURED_APP_IDS];

export function createPaymentAppPrefsRepository(db: AnyDb) {
  return {
    /** Saved order first, then catalogue apps without a saved position. Unknown keys are dropped. */
    async getAppOrder(catalogue: string[] = catalogueIds()): Promise<string[]> {
      const rows = await db
        .select()
        .from(paymentAppPrefs)
        .where(isNull(paymentAppPrefs.deleted_at))
        .orderBy(asc(paymentAppPrefs.sort_order));
      const saved = rows
        .map((r) => normalizeAppId(r.app_key))
        .filter((k, i, arr) => catalogue.includes(k) && arr.indexOf(k) === i);
      return [...saved, ...catalogue.filter((k) => !saved.includes(k))];
    },

    /** Replaces the saved order in one transaction. Revives soft-deleted rows. */
    async setAppOrder(keys: string[]): Promise<void> {
      const unique = keys.filter((k, i) => keys.indexOf(k) === i);
      const now = nowUtc();
      (db as unknown as SyncTxDb).transaction((tx) => {
        unique.forEach((app_key, sort_order) => {
          tx.insert(paymentAppPrefs)
            .values({ id: newId(), created_at: now, updated_at: now, app_key, sort_order })
            .onConflictDoUpdate({
              target: paymentAppPrefs.app_key,
              targetWhere: isNull(paymentAppPrefs.deleted_at),
              set: { sort_order, updated_at: now, deleted_at: null },
            })
            .run();
        });
      });
    },
  };
}

export type PaymentAppPrefsRepository = ReturnType<typeof createPaymentAppPrefsRepository>;
