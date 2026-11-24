import type { HandOffResult } from "../payConfirm/handOff";

import { autoDeleteAvailable, type QrPlatform } from "./decide";

export type RecordQrImageDeps = {
  platform: QrPlatform;
  handOffs: { setQrAsset: (id: string, assetId: string) => Promise<unknown> };
  preferences: {
    getQrAutoDelete: () => Promise<boolean>;
    setQrAutoDelete: (on: boolean) => Promise<void>;
  };
  showToast: (text: string) => void;
  /** Toast text shown once when auto-delete is switched off. */
  addOnlyMessage: string;
};

/** Records the album asset id on the hand-off and turns auto-delete off (once, with a toast) for iOS add-only access. */
export async function recordQrImage(
  deps: RecordQrImageDeps,
  handOffId: string,
  result: Pick<HandOffResult, "qrStorage" | "qrAssetId" | "photoAccess">,
): Promise<void> {
  if (result.qrStorage !== "album" || !result.qrAssetId) return;
  await deps.handOffs.setQrAsset(handOffId, result.qrAssetId);
  if (!result.photoAccess) return;
  if (autoDeleteAvailable({ platform: deps.platform, access: result.photoAccess })) return;
  const wasOn = await deps.preferences.getQrAutoDelete();
  if (!wasOn) return;
  await deps.preferences.setQrAutoDelete(false);
  deps.showToast(deps.addOnlyMessage);
}
