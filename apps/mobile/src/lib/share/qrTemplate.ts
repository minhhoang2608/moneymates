import { formatVnd } from "@/lib/money";
import { findBankByBin, generateVietQr } from "@/lib/vietqr";
import QRCode from "qrcode";

import { vi } from "@/i18n/vi";

export const CANVAS_W = 600;
export const CANVAS_H = 900;
const PAD_X = 48;
const PAD_Y = 36;
const LOGO = 36;
const GAP = 22;
const QUIET = 4;
const TARGET_BOX = 440;
const MIN_BOX = 420;
const NAME_MAX_CHARS = 28;

export type QrImageInput = {
  name?: string;
  bankBin: string;
  bankName?: string;
  account: string;
  amount?: number;
  message?: string;
};

export type QrImageContent = {
  payload: string;
  title: string | null;
  bankLine: string;
  amountLine: string | null;
  messageLine: string | null;
  footer: string;
};

/** "0123456789" → "0123 4567 89". */
export function groupAccount(account: string): string {
  return account.replace(/(.{4})(?=.)/g, "$1 ");
}

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s;
}

export function buildQrImageContent(input: QrImageInput): QrImageContent {
  const message = input.message?.trim() || undefined;
  // No merchant name (tag 59): keep the canonical bank-transfer VietQR every bank app reads.
  const payload = generateVietQr({
    bankBin: input.bankBin,
    account: input.account,
    amount: input.amount,
    message,
  });
  const bankName = input.bankName?.trim() || findBankByBin(input.bankBin)?.shortName || input.bankBin;
  const name = input.name?.trim();
  return {
    payload,
    title: name ? truncate(name, NAME_MAX_CHARS) : null,
    bankLine: `${bankName} · ${groupAccount(input.account)}`,
    amountLine: input.amount !== undefined ? formatVnd(input.amount) : null,
    messageLine: message ?? null,
    footer: vi.payConfirm.qrImageFooter,
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
  logoY: number;
  moduleSize: number;
  box: { x: number; y: number; size: number };
  /** Top-left of the first dark-module cell (box + quiet zone). */
  qrOrigin: { x: number; y: number };
  quietZone: number;
  title: Block | null;
  bank: Block;
  amount: Block | null;
  message: Block | null;
  footer: Block;
};

const block = (top: number, fontSize: number, lineHeight: number): Block => ({
  top,
  height: lineHeight,
  baseline: top + Math.round(lineHeight * 0.75),
  fontSize,
});

export function computeQrImageLayout(
  moduleCount: number,
  opts: { hasTitle?: boolean; hasAmount: boolean; hasMessage: boolean },
): QrImageLayout {
  const cells = moduleCount + QUIET * 2;
  let moduleSize = Math.floor(TARGET_BOX / cells);
  if (moduleSize * cells < MIN_BOX) moduleSize = TARGET_BOX / cells;
  const boxSize = moduleSize * cells;
  const boxX = (CANVAS_W - boxSize) / 2;
  const boxY = PAD_Y + LOGO + GAP;
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
  const footer = block(CANVAS_H - PAD_Y - 20, 15, 20);

  return {
    width: CANVAS_W,
    height: CANVAS_H,
    centerX: CANVAS_W / 2,
    logoY: PAD_Y,
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

export const PAD = { x: PAD_X, y: PAD_Y };
