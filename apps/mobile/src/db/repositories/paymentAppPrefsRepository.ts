import { and, asc, eq, isNull } from "drizzle-orm";

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

    /** Enabled apps ("Đang bật") in saved order. Empty on a fresh DB. Not filtered against the catalogue. */
    async getEnabledApps(): Promise<string[]> {
      const rows = await db
        .select()
        .from(paymentAppPrefs)
        .where(and(isNull(paymentAppPrefs.deleted_at), eq(paymentAppPrefs.enabled, true)))
        .orderBy(asc(paymentAppPrefs.sort_order));
      return rows.map((r) => normalizeAppId(r.app_key)).filter((k, i, arr) => arr.indexOf(k) === i);
    },

    /** Enables or disables one app. Enabling appends it to the end of the enabled list. The row is kept. */
    async setEnabled(key: string, enabled: boolean): Promise<void> {
      const app_key = normalizeAppId(key);
      const now = nowUtc();
      (db as unknown as SyncTxDb).transaction((tx) => {
        const live = tx.select().from(paymentAppPrefs).where(isNull(paymentAppPrefs.deleted_at)).all() as {
          app_key: string;
          sort_order: number;
          enabled: boolean;
        }[];
        const existing = live.find((r) => r.app_key === app_key);
        const maxOrder = live.filter((r) => r.enabled).reduce((m, r) => Math.max(m, r.sort_order), -1);
        const sort_order = enabled
          ? existing?.enabled
            ? existing.sort_order
            : maxOrder + 1
          : (existing?.sort_order ?? maxOrder + 1);
        tx.insert(paymentAppPrefs)
          .values({ id: newId(), created_at: now, updated_at: now, app_key, sort_order, enabled })
          .onConflictDoUpdate({
            target: paymentAppPrefs.app_key,
            targetWhere: isNull(paymentAppPrefs.deleted_at),
            set: { sort_order, enabled, updated_at: now, deleted_at: null },
          })
          .run();
      });
    },

    /** Makes the enabled list exactly `keys` (in order). Other live rows are disabled and placed after. */
    async setEnabledOrder(keys: string[]): Promise<void> {
      const unique = keys.map(normalizeAppId).filter((k, i, arr) => arr.indexOf(k) === i);
      const now = nowUtc();
      (db as unknown as SyncTxDb).transaction((tx) => {
        const others = (
          tx.select().from(paymentAppPrefs).where(isNull(paymentAppPrefs.deleted_at)).all() as {
            app_key: string;
            sort_order: number;
          }[]
        )
          .filter((r) => !unique.includes(normalizeAppId(r.app_key)))
          .sort((a, b) => a.sort_order - b.sort_order);
        unique.forEach((app_key, sort_order) => {
          tx.insert(paymentAppPrefs)
            .values({ id: newId(), created_at: now, updated_at: now, app_key, sort_order, enabled: true })
            .onConflictDoUpdate({
              target: paymentAppPrefs.app_key,
              targetWhere: isNull(paymentAppPrefs.deleted_at),
              set: { sort_order, enabled: true, updated_at: now, deleted_at: null },
            })
            .run();
        });
        others.forEach((r, i) => {
          tx.update(paymentAppPrefs)
            .set({ enabled: false, sort_order: unique.length + i, updated_at: now })
            .where(and(eq(paymentAppPrefs.app_key, r.app_key), isNull(paymentAppPrefs.deleted_at)))
            .run();
        });
      });
    },

    /** True once any live preference row exists (the user has chosen). */
    async hasChosen(): Promise<boolean> {
      const rows = await db.select().from(paymentAppPrefs).where(isNull(paymentAppPrefs.deleted_at)).limit(1);
      return rows.length > 0;
    },
  };
}

export type PaymentAppPrefsRepository = ReturnType<typeof createPaymentAppPrefsRepository>;
