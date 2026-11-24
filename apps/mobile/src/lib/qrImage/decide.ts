import type { PayApp } from "../payConfirm/apps";

export type QrPlatform = "android" | "ios";
export type QrStorage = "none" | "cache" | "album";
export type QrDeletionMode = "silent" | "batch-dialog";
export type PhotoPermission = {
  platform: QrPlatform;
  access: "read-write" | "limited" | "add-only";
};

export function decideQrStorage(input: {
  platform: QrPlatform;
  app: Pick<PayApp, "supportsAutofill">;
  bankAcceptsDirectShare: boolean;
}): QrStorage {
  if (input.app.supportsAutofill) return "none";
  if (input.platform === "android" && input.bankAcceptsDirectShare) return "cache";
  return "album";
}

export function decideQrDeletion(input: { platform: QrPlatform }): QrDeletionMode {
  return input.platform === "android" ? "silent" : "batch-dialog";
}

export function autoDeleteAvailable(permission: PhotoPermission): boolean {
  return !(permission.platform === "ios" && permission.access === "add-only");
}
