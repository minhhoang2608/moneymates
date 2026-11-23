import { parseVietQr } from "./parse";

export type ScanRoute =
  { ok: true; href: { pathname: "/pay-confirm"; params: Record<string, string> } } | { ok: false };

/** Turn a decoded QR string into the /pay-confirm route, or an error. Params are strings (expo-router). */
export function scanResultToRoute(text: unknown): ScanRoute {
  const r = parseVietQr(text);
  if (r.kind === "invalid") return { ok: false };
  const params: Record<string, string> = {};
  if (r.kind === "vietqr") {
    params.kind = "vietqr";
    params.payload = String(text).trim();
    params.bankBin = r.bankBin;
    params.bankName = r.bankName;
    params.account = r.account;
    if (r.name) params.name = r.name;
    if (r.amount !== undefined) params.amount = String(r.amount);
    if (r.message) params.message = r.message;
    params.isDynamic = r.isDynamic ? "1" : "0";
  } else {
    params.kind = "other";
    if (r.amount !== undefined) params.amount = String(r.amount);
    params.payload = String(text).trim();
  }
  return { ok: true, href: { pathname: "/pay-confirm", params } };
}
