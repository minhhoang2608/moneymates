import { generateVietQr } from "@/lib/vietqr";

import type { PayConfirmModel } from "./params";

/**
 * The QR to save or share: a fresh VietQR built from the confirmed amount and message
 * (the scanned QR may have had other values, or none). Non-VietQR codes keep the scanned payload.
 * Saved as an image and read by bank apps' "scan from photo", so it uses the canonical tag set.
 */
export function buildConfirmedQrPayload(model: PayConfirmModel, amount: number | undefined, note: string): string {
  if (model.kind !== "vietqr") return model.payload;
  try {
    return generateVietQr({
      bankBin: model.bankBin,
      account: model.account,
      // No merchant name (tag 59): keep the canonical bank-transfer VietQR that every bank app reads.
      amount,
      message: note,
    });
  } catch {
    return model.payload;
  }
}
