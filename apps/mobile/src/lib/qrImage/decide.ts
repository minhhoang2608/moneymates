import type { PayApp } from "../payConfirm/apps";
import type { NonAutofillMode } from "../preferences/defaults";

export type QrPlatform = "android" | "ios";
export type QrStorage = "none" | "cache" | "album";
export type QrDeletionMode = "silent" | "batch-dialog";
export type PhotoPermission = {
  platform: QrPlatform;
  access: "read-write" | "limited" | "add-only";
};

export type QrHandOffInput = {
  platform: QrPlatform;
  app: Pick<PayApp, "supportsAutofill">;
  bankAcceptsDirectShare: boolean;
  /** Defaults to "qr_image". */
  nonAutofillMode?: NonAutofillMode;
};

/** Where the QR image goes and how the user gets the transfer into the bank app. */
export function decideQrHandOff(input: QrHandOffInput): { storage: QrStorage; method: "image" | "paste" } {
  if (input.app.supportsAutofill) return { storage: "none", method: "image" };
  if (input.nonAutofillMode === "no_image") return { storage: "none", method: "paste" };
  // Always the album, even when the bank is known to take the shared image: apps like Techcombank only offer
  // "Ảnh có chứa mã QR thanh toán" (one tap to the prefilled transfer) for the newest photo in the gallery.
  // The image is still deleted as soon as the user returns to MoneyMates.
  return { storage: "album", method: "image" };
}

export function decideQrStorage(input: QrHandOffInput): QrStorage {
  return decideQrHandOff(input).storage;
}

export function decideQrDeletion(input: { platform: QrPlatform }): QrDeletionMode {
  return input.platform === "android" ? "silent" : "batch-dialog";
}

export function autoDeleteAvailable(permission: PhotoPermission): boolean {
  return !(permission.platform === "ios" && permission.access === "add-only");
}
