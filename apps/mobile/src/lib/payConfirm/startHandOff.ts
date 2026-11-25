import { recordQrImage, type RecordQrImageDeps } from "../qrImage/record";
import type { PayApp } from "./apps";
import type { HandOffResult, HandOffInput } from "./handOff";
import { methodFromResult } from "./paidRule";
import { knownResultFor } from "./shareMemory";

export type StartHandOffDeps = {
  makeHandOff: (
    getQrBase64: () => Promise<string | null>,
  ) => (app: PayApp, input: HandOffInput) => Promise<HandOffResult>;
  handOffs: RecordQrImageDeps["handOffs"] & {
    create: (input: {
      transaction_id: string;
      app_id: string;
      method: ReturnType<typeof methodFromResult>;
      started_at: Date;
    }) => Promise<{ id: string }>;
  };
  handOffMemory: {
    getShareMemory: () => Promise<Record<string, "share_ok" | "share_failed">>;
    setShareResult: (appId: string, worked: boolean) => Promise<unknown>;
  };
  record: Omit<RecordQrImageDeps, "handOffs">;
};

export type StartHandOffArgs = {
  app: PayApp;
  model: HandOffInput["model"];
  amount: number;
  note: string;
  nonAutofillMode?: HandOffInput["nonAutofillMode"];
  /** Transaction the hand-off belongs to; no hand-off row is stored without it. */
  txId?: string;
  getQrBase64: () => Promise<string | null>;
  /** Called with the new hand-off row id as soon as it exists. */
  onRow?: (handOffId: string) => void;
};

/**
 * Hands the payment to the app, stores a hand-off row (new `started_at`), records the QR album asset
 * and remembers a rejected share. Used by the confirm screen and by "Mở lại". Rejects only when the hand-off itself throws.
 */
export async function startHandOff(deps: StartHandOffDeps, args: StartHandOffArgs): Promise<HandOffResult> {
  const { app, model, amount, note, txId, getQrBase64, onRow, nonAutofillMode } = args;
  const handOff = deps.makeHandOff(getQrBase64);
  const started_at = new Date();
  const memory = await deps.handOffMemory.getShareMemory().catch(() => ({}));
  const result = await handOff(app, {
    model,
    amount,
    note,
    knownResult: knownResultFor(memory, app.id),
    nonAutofillMode,
  });
  const { mode, decision, share } = result;
  if (txId) {
    try {
      const row = await deps.handOffs.create({
        transaction_id: txId,
        app_id: app.id,
        method: methodFromResult({ mode, decision, share }),
        started_at,
      });
      onRow?.(row.id);
      await recordQrImage({ ...deps.record, handOffs: deps.handOffs }, row.id, result).catch((e) =>
        console.warn("could not record QR image", e),
      );
    } catch (e) {
      console.warn("could not record hand-off", e);
    }
  }
  if (share === "share_failed") await deps.handOffMemory.setShareResult(app.id, false).catch(() => {});
  return result;
}
