import { formatVnd } from "@/lib/money";
import { findBankByBin, generateVietQr } from "@/lib/vietqr";
import QRCode from "qrcode";

import { vi } from "@/i18n/vi";

export const CANVAS_W = 600;
export const CANVAS_H = 900;
const PAD_Y = 48;
const GAP = 22;
const QUIET = 4;
const TARGET_BOX = 520;
const MIN_BOX = 500;
const NAME_MAX_CHARS = 28;

export type QrImageInput = {
  name?: string;
  bankBin: string;
  bankName?: string;
  account: string;
  amount?: number;
  message?: string;
  /** Encoded instead when a fresh VietQR cannot be built (bad amount, over-long note, bad bank/account). */
  fallbackPayload?: string;
  /** Default true: adds the "temporary image, auto-deleted" footer. False for images the user keeps (popup QR). */
  temporary?: boolean;
};

export type QrImageContent = {
  payload: string;
  title: string | null;
  bankLine: string;
  amountLine: string | null;
  messageLine: string | null;
  footer: string | null;
};

/** "0123456789" → "0123 4567 89". */
export function groupAccount(account: string): string {
  return account.replace(/(.{4})(?=.)/g, "$1 ");
}

/** Merchant QRs often carry "Cua hang X" / "Cửa hàng X" as the name; the prefix is noise on the transfer image. */
export function stripShopPrefix(name: string): string {
  const stripped = name.replace(/^c(?:ua|ửa)\s+h(?:ang|àng)\s+/i, "").trim();
  return stripped || name;
}

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s;
}

export function buildQrImageContent(input: QrImageInput): QrImageContent {
  const message = input.message?.trim() || undefined;
  // No merchant name (tag 59): keep the canonical bank-transfer VietQR every bank app reads.
  let payload: string;
  let amountValid = input.amount !== undefined && Number.isSafeInteger(input.amount) && input.amount > 0;
  try {
    payload = generateVietQr({
      bankBin: input.bankBin,
      account: input.account,
      amount: input.amount,
      message,
    });
  } catch (e) {
    // Never throw into render: fall back to the scanned payload, as buildConfirmedQrPayload does.
    if (input.fallbackPayload === undefined) throw e;
    payload = input.fallbackPayload;
  }
  const bankName = input.bankName?.trim() || findBankByBin(input.bankBin)?.shortName || input.bankBin;
  const name = input.name?.trim() ? stripShopPrefix(input.name.trim()) : undefined;
  return {
    payload,
    title: name ? truncate(name, NAME_MAX_CHARS) : null,
    bankLine: `${bankName} · ${groupAccount(input.account)}`,
    amountLine: amountValid && input.amount !== undefined ? formatVnd(input.amount) : null,
    messageLine: message ?? null,
    footer: input.temporary === false ? null : vi.payConfirm.qrImageFooter,
  };
}

export type QrMatrix = { size: number; isDark: (row: number, col: number) => boolean };

export function qrMatrix(payload: string): QrMatrix {
  const { modules } = QRCode.create(payload, { errorCorrectionLevel: "M" });
  return { size: modules.size, isDark: (r, c) => modules.get(r, c) === 1 };
}

export type Block = { top: number; height: number; baseline: number; fontSize: number };

export type QrImageLayout = {
  width: number;
  height: number;
  centerX: number;
  moduleSize: number;
  box: { x: number; y: number; size: number };
  /** Top-left of the first dark-module cell (box + quiet zone). */
  qrOrigin: { x: number; y: number };
  quietZone: number;
  title: Block | null;
  bank: Block;
  amount: Block | null;
  message: Block | null;
  footer: Block | null;
};

const block = (top: number, fontSize: number, lineHeight: number): Block => ({
  top,
  height: lineHeight,
  baseline: top + Math.round(lineHeight * 0.75),
  fontSize,
});

export function computeQrImageLayout(
  moduleCount: number,
  opts: { hasTitle?: boolean; hasAmount: boolean; hasMessage: boolean; hasFooter?: boolean },
): QrImageLayout {
  const cells = moduleCount + QUIET * 2;
  let moduleSize = Math.floor(TARGET_BOX / cells);
  if (moduleSize * cells < MIN_BOX) moduleSize = TARGET_BOX / cells;
  const boxSize = moduleSize * cells;
  const boxX = (CANVAS_W - boxSize) / 2;
  const boxY = PAD_Y;
  let y = boxY + boxSize + GAP;

  const hasTitle = opts.hasTitle ?? true;
  const title = hasTitle ? block(y, 26, 32) : null;
  if (title) y += title.height + 6;
  const bank = block(y, 20, 26);
  y += bank.height;
  let amount: Block | null = null;
  if (opts.hasAmount) {
    y += 6 + 8;
    amount = block(y, 40, 48);
    y += amount.height;
  }
  let message: Block | null = null;
  if (opts.hasMessage) {
    y += 6;
    message = block(y, 18, 24);
  }
  const footer = opts.hasFooter === false ? null : block(CANVAS_H - PAD_Y - 20, 15, 20);

  return {
    width: CANVAS_W,
    height: CANVAS_H,
    centerX: CANVAS_W / 2,
    moduleSize,
    box: { x: boxX, y: boxY, size: boxSize },
    qrOrigin: { x: boxX + QUIET * moduleSize, y: boxY + QUIET * moduleSize },
    quietZone: QUIET * moduleSize,
    title,
    bank,
    amount,
    message,
    footer,
  };
}

export type QrOnlyLayout = {
  width: number;
  height: number;
  moduleSize: number;
  box: { x: number; y: number; size: number };
  qrOrigin: { x: number; y: number };
  quietZone: number;
};

/** Pixels per module of the QR-only image. The export is exactly this many px per module (see QrImageTemplate). */
export const QR_ONLY_MODULE_PX = 12;

/**
 * The bare QR on a white square (no text): the code plus its 4-module quiet zone and nothing else, at exactly
 * QR_ONLY_MODULE_PX per module. Exported at that pixel size (not 600 dp x screen density, which gave 2100 px images
 * with fractional modules that MoMo's gallery scan rejected).
 */
export function computeQrOnlyLayout(moduleCount: number): QrOnlyLayout {
  const cells = moduleCount + QUIET * 2;
  const moduleSize = QR_ONLY_MODULE_PX;
  const boxSize = moduleSize * cells;
  const box = { x: 0, y: 0, size: boxSize };
  return {
    width: boxSize,
    height: boxSize,
    moduleSize,
    box,
    qrOrigin: { x: box.x + QUIET * moduleSize, y: box.y + QUIET * moduleSize },
    quietZone: QUIET * moduleSize,
  };
}
