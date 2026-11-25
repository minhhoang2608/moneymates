import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  createCategoryRepository,
  createHandOffRepository,
  createTransactionRepository,
} from "../../../db/repositories";
import type { AnyDb } from "../../../db/seed";
import { openTestDb } from "../../../db/testing/testDb";
import { generateVietQr } from "../../vietqr";
import { applyReceipt, saveReceiptTransaction, undoReceipt, type ReceiptDeps } from "../apply";
import type { ParsedReceipt } from "../rules";

const now = new Date("2026-01-01T10:00:00.000Z");
const uri = "file:///r.jpg";
const parsed = (p: Partial<ParsedReceipt> = {}): ParsedReceipt => ({
  amount: 55000,
  recipient: "QUAN PHO HOA",
  bankName: null,
  accountNumber: "0123456789",
  message: null,
  paidAt: null,
  transactionId: null,
  ...p,
});

async function setup() {
  const db = openTestDb(path.join(fs.mkdtempSync(path.join(os.tmpdir(), "mm-rc-")), "t.db")).db as unknown as AnyDb;
  const handOffs = createHandOffRepository(db);
  const transactions = createTransactionRepository(db);
  const categories = createCategoryRepository(db);
  const cat = (await categories.listByKind("expense"))[0];
  const qr = generateVietQr({ bankBin: "970436", account: "0123456789", name: "QUAN PHO HOA", amount: 55000 });
  const tx = await transactions.create({
    type: "expense",
    amount: 55000,
    category_id: cat.id,
    note: "x",
    occurred_at: now.toISOString(),
    source: "qr",
    qr_data: qr,
  });
  const ho = await handOffs.create({
    transaction_id: tx.id,
    app_id: "mb",
    method: "autofill",
    started_at: new Date(now.getTime() - 5 * 60_000),
  });
  const deps = { handOffs, transactions, categories } as unknown as ReceiptDeps;
  return { deps, handOffs, transactions, categories, ho };
}

describe("applyReceipt", () => {
  it("matches a pending hand-off and attaches the receipt", async () => {
    const { deps, handOffs, ho } = await setup();
    const r = await applyReceipt(deps, { uri, parsed: parsed(), now });
    expect(r.kind).toBe("matched");
    const row = await handOffs.get(ho.id);
    expect(row?.paid_signal).toBe("receipt");
    expect(row?.receipt_uri).toBe(uri);
  });

  it("drafts a new transaction when nothing matches", async () => {
    const { deps, categories } = await setup();
    const r = await applyReceipt(deps, { uri, parsed: parsed({ amount: 99000 }), now });
    expect(r.kind).toBe("new");
    if (r.kind !== "new") return;
    const rows = await categories.listByKind("expense");
    expect(r.draft).toMatchObject({ source: "receipt", amount: 99000, uri });
    expect(r.draft.categoryId).toBe(rows.find((c) => c.name === "Ăn uống")?.id);
    const u = await applyReceipt(deps, { uri, parsed: parsed({ amount: 99000, recipient: "ZZZ" }), now });
    if (u.kind === "new") expect(u.draft.categoryId).toBe(rows.find((c) => c.name === "Khác")?.id);
  });

  it("undo clears the receipt and our paid signal only", async () => {
    const { deps, handOffs, ho } = await setup();
    const r = await applyReceipt(deps, { uri, parsed: parsed(), now });
    if (r.kind !== "matched") throw new Error("expected match");
    await undoReceipt(deps, r.undo);
    const row = await handOffs.get(ho.id);
    expect(row?.receipt_uri).toBeNull();
    expect(row?.paid_signal).toBeNull();
  });

  it("undo keeps an earlier time signal", async () => {
    const { deps, handOffs, ho } = await setup();
    await handOffs.markPaid(ho.id, "time");
    const r = await applyReceipt(deps, { uri, parsed: parsed(), now });
    if (r.kind !== "matched") throw new Error("expected match");
    expect((await handOffs.get(ho.id))?.receipt_uri).toBe(uri);
    await undoReceipt(deps, r.undo);
    const row = await handOffs.get(ho.id);
    expect(row?.paid_signal).toBe("time");
    expect(row?.receipt_uri).toBeNull();
  });

  it("saves a receipt transaction with an integer amount", async () => {
    const { deps, transactions } = await setup();
    const r = await applyReceipt(deps, { uri, parsed: parsed({ amount: 99000 }), now });
    if (r.kind !== "new") throw new Error("expected new");
    const tx = (await saveReceiptTransaction(deps, r.draft)) as Awaited<ReturnType<typeof transactions.create>>;
    expect(Number.isInteger(tx.amount)).toBe(true);
    expect(tx).toMatchObject({ amount: 99000, source: "receipt", attachment_uri: uri, currency: "VND" });
    await expect(saveReceiptTransaction(deps, { ...r.draft, amount: null })).rejects.toThrow("invalid_amount");
    await expect(saveReceiptTransaction(deps, { ...r.draft, amount: 1.5 })).rejects.toThrow("invalid_amount");
  });

  it("returns an empty draft when the amount is unreadable", async () => {
    const { deps, categories } = await setup();
    const r = await applyReceipt(deps, { uri, parsed: parsed({ amount: null }), now });
    expect(r.kind).toBe("new");
    if (r.kind !== "new") return;
    const other = (await categories.listByKind("expense")).find((c) => c.name === "Khác");
    expect(r.draft).toMatchObject({ amount: null, recipient: "", note: "", categoryId: other?.id, uri });
  });
});
