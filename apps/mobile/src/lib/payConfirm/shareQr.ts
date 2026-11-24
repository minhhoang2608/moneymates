export type ShareQrDeps = {
  getQrBase64: () => Promise<string | null>;
  setClipboard: (text: string) => Promise<void>;
  share: (base64: string) => Promise<"shared" | "unavailable">;
};

/** Android share sheet: copies the "account amount message" text, then shares the regenerated QR image. */
export async function shareConfirmedQr(deps: ShareQrDeps, clipboardText: string): Promise<"shared" | "unavailable"> {
  const b64 = await deps.getQrBase64();
  if (!b64) return "unavailable";
  try {
    await deps.setClipboard(clipboardText);
  } catch (e) {
    console.warn("clipboard failed", e);
  }
  return deps.share(b64);
}
