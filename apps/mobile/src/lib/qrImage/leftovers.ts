export const LEFTOVER_AGE_MS = 24 * 60 * 60 * 1000;

export function selectLeftovers<
  T extends { qr_asset_id: string | null; qr_deleted_at: string | null; started_at: string },
>(handOffs: T[], now: Date): T[] {
  return handOffs.filter((h) => {
    if (!h.qr_asset_id || h.qr_deleted_at !== null) return false;
    const started = Date.parse(h.started_at);
    if (Number.isNaN(started)) return false;
    return now.getTime() - started > LEFTOVER_AGE_MS;
  });
}
