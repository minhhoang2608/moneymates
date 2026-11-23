import type { PayApp } from "./apps";

export type DeeplinkInput = { account: string; bin: string; amount?: number; message?: string };

/** VietQR public deeplink that opens the app with the transfer prefilled. */
export function buildAutofillUrl(app: PayApp, input: DeeplinkInput): string {
  const parts = [
    `app=${encodeURIComponent(app.deeplinkCode)}`,
    `ba=${encodeURIComponent(`${input.account}@${input.bin}`)}`,
  ];
  if (input.amount !== undefined && Number.isSafeInteger(input.amount) && input.amount > 0) {
    parts.push(`am=${input.amount}`);
  }
  if (input.message) parts.push(`tn=${encodeURIComponent(input.message)}`);
  return `https://dl.vietqr.io/pay?${parts.join("&")}`;
}

export function buildOpenUrl(app: PayApp): string {
  return `${app.scheme}://`;
}
