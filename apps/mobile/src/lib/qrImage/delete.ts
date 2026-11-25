import { autoDeleteAvailable, type PhotoPermission } from "./decide";

export type QrMediaLibrary = {
  /** Resolves true when the assets were deleted; false when the user declined the system dialog. */
  deleteAssets: (assetIds: string[]) => Promise<boolean>;
  getPermission: () => Promise<PhotoPermission>;
};

type HandOffLike = { id: string; qr_asset_id: string | null; qr_deleted_at: string | null; deleted_at?: string | null };

export type QrDeleteDeps = {
  media: QrMediaLibrary;
  handOffs: {
    get: (id: string) => Promise<HandOffLike | null>;
    listPendingQrImages: () => Promise<HandOffLike[]>;
    markQrDeleted: (id: string, at?: Date) => Promise<unknown>;
  };
  now?: () => Date;
};

export type QrDeleteResult = { deleted: string[] };

/** Deletes the temporary QR images of the given hand-offs with one batch call (one system dialog on iOS). */
export function createQrImageDeleter(deps: QrDeleteDeps) {
  const now = deps.now ?? (() => new Date());

  async function deleteQrImages(handOffIds: string[]): Promise<QrDeleteResult> {
    const rows: HandOffLike[] = [];
    for (const id of new Set(handOffIds)) {
      const row = await deps.handOffs.get(id);
      if (row && row.qr_asset_id && row.qr_deleted_at === null && !row.deleted_at) rows.push(row);
    }
    if (rows.length === 0) return { deleted: [] };
    const assetIds = [...new Set(rows.map((r) => r.qr_asset_id as string))];
    let ok = false;
    try {
      ok = await deps.media.deleteAssets(assetIds);
    } catch {
      ok = false;
    }
    if (!ok) return { deleted: [] };
    const at = now();
    for (const row of rows) await deps.handOffs.markQrDeleted(row.id, at);
    return { deleted: rows.map((r) => r.id) };
  }

  async function deletePendingOnReturn(): Promise<QrDeleteResult> {
    let permission: PhotoPermission;
    try {
      permission = await deps.media.getPermission();
    } catch {
      return { deleted: [] };
    }
    if (!autoDeleteAvailable(permission)) return { deleted: [] };
    const pending = await deps.handOffs.listPendingQrImages();
    return deleteQrImages(pending.map((p) => p.id));
  }

  const deleteQrImageForHandOff = (handOffId: string) => deleteQrImages([handOffId]);

  return { deleteQrImages, deletePendingOnReturn, deleteQrImageForHandOff };
}
