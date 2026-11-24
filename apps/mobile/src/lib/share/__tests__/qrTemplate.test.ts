import { vi } from "@/i18n/vi";
import { parseVietQr } from "@/lib/vietqr";
import { hasValidCrc } from "@/lib/vietqr/crc16";
import { decodeTlv } from "@/lib/vietqr/tlv";

import { buildQrImageContent, CANVAS_H, CANVAS_W, computeQrImageLayout, groupAccount, qrMatrix } from "../qrTemplate";

function hasTag(payload: string, tag: string): boolean {
  const r = decodeTlv(payload);
  return r.ok && r.fields.has(tag);
}

const PHO = {
  name: "QUAN PHO HOA",
  bankBin: "970423",
  account: "0123456789",
  amount: 55000,
  message: "PHO HOA BAN 12",
};

describe("groupAccount", () => {
  it("groups digits by 4", () => {
    expect(groupAccount("0123456789")).toBe("0123 4567 89");
    expect(groupAccount("123")).toBe("123");
    expect(groupAccount("1234")).toBe("1234");
    expect(groupAccount("1234567890123456789")).toBe("1234 5678 9012 3456 789");
  });
});

describe("AC1 content", () => {
  it("builds the PHO HOA content", () => {
    const c = buildQrImageContent(PHO);
    expect(c.title).toBe("QUAN PHO HOA");
    expect(c.bankLine).toBe("TPBank · 0123 4567 89");
    expect(c.amountLine).toBe("55.000đ");
    expect(c.messageLine).toBe("PHO HOA BAN 12");
    expect(c.footer).toBe("Ảnh tạm của MoneyMates · tự xoá sau khi dùng");
  });
  it("falls back to the BIN and truncates long names", () => {
    expect(buildQrImageContent({ bankBin: "999999", account: "1" }).bankLine).toBe("999999 · 1");
    const c = buildQrImageContent({ ...PHO, name: "A".repeat(60) });
    expect(c.title!.endsWith("…")).toBe(true);
    expect(c.title!.length).toBeLessThanOrEqual(28);
  });
});

describe("AC2 payload", () => {
  it("is a valid VietQR without tag 59", () => {
    for (const name of [undefined, "QUAN PHO HOA"]) {
      const { payload } = buildQrImageContent({ ...PHO, name });
      expect(hasValidCrc(payload)).toBe(true);
      expect(parseVietQr(payload)).toMatchObject({
        kind: "vietqr",
        bankBin: "970423",
        account: "0123456789",
        amount: 55000,
        message: "PHO HOA BAN 12",
      });
      expect(hasTag(payload, "59")).toBe(false);
    }
  });
});

describe("AC3 layout math", () => {
  const counts = Array.from({ length: 10 }, (_, i) => 21 + 4 * i);
  const real = qrMatrix(buildQrImageContent(PHO).payload).size;
  it.each([...counts, real])("fits for %i modules", (n) => {
    const L = computeQrImageLayout(n, { hasAmount: true, hasMessage: true });
    expect(L.width).toBe(CANVAS_W);
    expect(L.height).toBe(CANVAS_H);
    expect(L.box.size).toBeGreaterThanOrEqual(0.7 * CANVAS_W);
    expect(L.quietZone).toBeCloseTo(4 * L.moduleSize);
    expect(L.box.x + L.box.size).toBeLessThanOrEqual(CANVAS_W);
    const boxBottom = L.box.y + L.box.size;
    const blocks = [L.title!, L.bank, L.amount!, L.message!];
    for (const b of blocks) expect(b.top).toBeGreaterThanOrEqual(boxBottom);
    for (let i = 1; i < blocks.length; i++) {
      expect(blocks[i].top).toBeGreaterThanOrEqual(blocks[i - 1].top + blocks[i - 1].height);
    }
    const last = blocks[blocks.length - 1];
    expect(last.top + last.height).toBeLessThanOrEqual(L.footer!.top);
    expect(L.footer!.top + L.footer!.height).toBeLessThanOrEqual(CANVAS_H);
  });
  it("keeps the quiet zone white", () => {
    const m = qrMatrix(buildQrImageContent(PHO).payload);
    const L = computeQrImageLayout(m.size, { hasAmount: true, hasMessage: true });
    // Dark modules are only drawn from qrOrigin; the box edge to qrOrigin is the quiet zone.
    expect(L.qrOrigin.x - L.box.x).toBeCloseTo(L.quietZone);
    expect(L.qrOrigin.y - L.box.y).toBeCloseTo(L.quietZone);
    expect(L.qrOrigin.x + m.size * L.moduleSize + L.quietZone).toBeCloseTo(L.box.x + L.box.size);
  });
});

describe("AC4 static, no message", () => {
  it("drops the message and amount-less tag 62", () => {
    const c = buildQrImageContent({ ...PHO, message: undefined });
    expect(c.messageLine).toBeNull();
    expect(hasTag(c.payload, "62")).toBe(false);
    const n = qrMatrix(c.payload).size;
    const full = computeQrImageLayout(n, { hasAmount: true, hasMessage: true });
    const none = computeQrImageLayout(n, { hasAmount: true, hasMessage: false });
    expect(none.message).toBeNull();
    expect(none.box).toEqual(full.box);
    expect(none.title).toEqual(full.title);
    expect(none.bank).toEqual(full.bank);
    expect(none.amount).toEqual(full.amount);
    expect(none.footer).toEqual(full.footer);
  });
});

describe("temporary footer (popup QR)", () => {
  const input = { bankBin: "970423", account: "0123456789", amount: 55000 };
  it("has no footer when temporary is false, and keeps it by default", () => {
    expect(buildQrImageContent({ ...input, temporary: false }).footer).toBeNull();
    expect(buildQrImageContent(input).footer).toBe(vi.payConfirm.qrImageFooter);
  });
  it("layout drops only the footer block", () => {
    const o = { hasAmount: true, hasMessage: true };
    const a = computeQrImageLayout(29, o);
    const b = computeQrImageLayout(29, { ...o, hasFooter: false });
    expect(b.footer).toBeNull();
    expect(a.footer).not.toBeNull();
    expect({ ...b, footer: null }).toEqual({ ...a, footer: null });
  });
});
