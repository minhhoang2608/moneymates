import { toAsciiText, MAX_MESSAGE_LENGTH } from "@/lib/vietqr/message";
import { findBankByBin } from "@/lib/vietqr/banks";

import type { PayApp } from "./apps";

export type DeeplinkInput = {
  account: string;
  bin: string;
  amount?: number;
  message?: string;
  /** Account holder name, sent as `bn` when known. */
  name?: string;
};

const RETURN_URL = "https://www.vietqr.io";
const DEEPLINK_BASE = "https://dl.vietqr.io/pay";

/** dl.vietqr.io bank codes that differ from `src/lib/vietqr/banks.ts` (VietinBank is `ICB` there, `CTG` in the catalogue). */
const BANK_CODE_OVERRIDES: Record<string, string> = { "970415": "icb" };

/** Lower-case VietQR bank code for a BIN, or undefined for an unknown bank. */
export function bankCodeForBin(bin: string): string | undefined {
  return BANK_CODE_OVERRIDES[bin] ?? findBankByBin(bin)?.code.toLowerCase();
}

/** Transfer message for `tn`: ASCII without diacritics, at most 25 characters. */
export function buildTn(message?: string): string {
  return toAsciiText(message ?? "")
    .slice(0, MAX_MESSAGE_LENGTH)
    .trim();
}

/**
 * VietQR public deeplink that opens an autofill-capable app with the transfer prefilled.
 * Returns null when the scanned bank is not in the catalogue (no `ba` can be built).
 */
export function buildAutofillUrl(app: PayApp, input: DeeplinkInput): string | null {
  const code = bankCodeForBin(input.bin);
  if (!code) return null;
  const parts = [`app=${encodeURIComponent(app.deeplinkCode)}`, `ba=${encodeURIComponent(`${input.account}@${code}`)}`];
  if (input.amount !== undefined && Number.isSafeInteger(input.amount) && input.amount > 0) {
    parts.push(`am=${input.amount}`);
  }
  const tn = buildTn(input.message);
  if (tn) parts.push(`tn=${encodeURIComponent(tn)}`);
  const bn = input.name ? toAsciiText(input.name) : "";
  if (bn) parts.push(`bn=${encodeURIComponent(bn)}`);
  parts.push(`url=${encodeURIComponent(RETURN_URL)}`);
  return `${DEEPLINK_BASE}?${parts.join("&")}`;
}

/**
 * The same prefilled link as an Android intent aimed at the app's package, so Android hands it to that app
 * without a browser hop. Null when the app has no known package or the link cannot be built. The caller falls
 * back to the https link when the app does not handle it.
 */
export function buildAutofillIntentUrl(app: PayApp, input: DeeplinkInput): string | null {
  if (!app.androidPackage) return null;
  const https = buildAutofillUrl(app, input);
  if (!https) return null;
  return `intent://${https.slice("https://".length)}#Intent;scheme=https;package=${app.androidPackage};end`;
}

/** Opens the app without any data: directly by scheme, or (no known scheme) through the plain VietQR deeplink. */
export function buildOpenUrl(app: PayApp): string {
  return app.scheme ? `${app.scheme}://` : `${DEEPLINK_BASE}?app=${encodeURIComponent(app.deeplinkCode)}`;
}

/** Android intent URI that launches an installed package (needs the native module: RN Linking can't resolve it). */
export function buildAndroidIntentUrl(pkg: string): string {
  return `intent://#Intent;package=${pkg};end`;
}

/**
 * Ways to open an app without data, most direct first: Android launch intent, custom scheme, then the plain
 * VietQR deeplink (a browser hop, but it resolves the app on every device). The hand-off tries them in order,
 * because a launch intent fails when Android hides the package from MoneyMates.
 */
export function buildOpenCandidates(app: PayApp, platform: "android" | "ios"): string[] {
  const urls: string[] = [];
  if (platform === "android" && app.androidPackage) urls.push(buildAndroidIntentUrl(app.androidPackage));
  if (app.scheme) urls.push(`${app.scheme}://`);
  urls.push(`${DEEPLINK_BASE}?app=${encodeURIComponent(app.deeplinkCode)}`);
  return [...new Set(urls)];
}

/** URL used to open an app without data: Android intent when the package is known, else scheme / VietQR link. */
export function buildPlatformOpenUrl(app: PayApp, platform: "android" | "ios"): string {
  if (platform === "android" && app.androidPackage) return buildAndroidIntentUrl(app.androidPackage);
  return buildOpenUrl(app);
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
