import { autoDeleteAvailable } from "./decide";
import { createQrImageDeleter, type QrDeleteDeps } from "./delete";
import { selectLeftovers } from "./leftovers";

type PendingRow = { id: string; qr_asset_id: string | null; qr_deleted_at: string | null; started_at: string };

export type SweepDeps = Omit<QrDeleteDeps, "handOffs"> & {
  handOffs: Omit<QrDeleteDeps["handOffs"], "listPendingQrImages"> & {
    listPendingQrImages: () => Promise<PendingRow[]>;
  };
  preferences: { getQrAutoDelete: () => Promise<boolean> };
  now?: () => Date;
};

/** Deletes temporary QR images whose hand-off started more than 24 h ago. Never throws; failures retry next start. */
export async function sweepLeftoverQrImages(deps: SweepDeps): Promise<{ deleted: string[] }> {
  const now = deps.now ?? (() => new Date());
  try {
    if (!(await deps.preferences.getQrAutoDelete())) return { deleted: [] };
    const leftovers = selectLeftovers(await deps.handOffs.listPendingQrImages(), now());
    if (leftovers.length === 0) return { deleted: [] };
    if (!autoDeleteAvailable(await deps.media.getPermission())) return { deleted: [] };
    return await createQrImageDeleter({ media: deps.media, handOffs: deps.handOffs, now }).deleteQrImages(
      leftovers.map((l) => l.id),
    );
  } catch (e) {
    console.warn("could not sweep leftover QR images", e);
    return { deleted: [] };
  }
}

let started = false;

/** Runs the sweep once per JS process (app start). */
export function runLeftoverSweepOnce(deps: SweepDeps): Promise<{ deleted: string[] }> {
  if (started) return Promise.resolve({ deleted: [] });
  started = true;
  return sweepLeftoverQrImages(deps);
}

export function resetLeftoverSweepForTests() {
  started = false;
}
