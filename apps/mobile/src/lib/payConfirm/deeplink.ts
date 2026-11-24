import type { PayApp } from "./apps";

/** Opens the app directly through its custom scheme. No browser hop (no dl.vietqr.io). */
export function buildOpenUrl(app: PayApp): string {
  return `${app.scheme}://`;
}

export type ClipboardInput = { account: string; amount?: number; message?: string };

/** "<account> <amount> <message>": amount and message are left out when empty or invalid. */
export function buildClipboardText(input: ClipboardInput): string {
  const parts = [input.account];
  if (input.amount !== undefined && Number.isSafeInteger(input.amount) && input.amount > 0) {
    parts.push(String(input.amount));
  }
  const message = input.message?.trim();
  if (message) parts.push(message);
  return parts.join(" ");
}
