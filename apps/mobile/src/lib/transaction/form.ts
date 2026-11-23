import { formatVnd, parseAmount } from "../money";

export type FormType = "expense" | "income";

export type FormState = {
  type: FormType;
  amountText: string;
  categoryId: string | null;
  note: string;
  occurredAt: Date;
  moneySource: string;
  photoUri: string | null;
};

export type FormInput = {
  type: FormType;
  amount: number;
  category_id: string;
  note: string;
  occurred_at: string;
  money_source: string;
  photo_uri: string | null;
};

export type FormErrors = { amount?: true; category?: true };

export type ValidateResult = { ok: true; input: FormInput } | { ok: false; errors: FormErrors };

export function validateForm(s: FormState): ValidateResult {
  const parsed = parseAmount(s.amountText);
  const errors: FormErrors = {};
  if (!parsed.ok) errors.amount = true;
  if (!s.categoryId) errors.category = true;
  if (!parsed.ok || !s.categoryId) return { ok: false, errors };
  return {
    ok: true,
    input: {
      type: s.type,
      amount: parsed.vnd,
      category_id: s.categoryId,
      note: s.note.trim(),
      occurred_at: s.occurredAt.toISOString(),
      money_source: s.moneySource,
      photo_uri: s.photoUri,
    },
  };
}

/** "−50.000đ" (U+2212) for expenses, "+25.000.000đ" for income. */
export function signedAmountLabel(type: FormType, vnd: number): string {
  return `${type === "expense" ? "−" : "+"}${formatVnd(vnd)}`;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** "Hôm nay, 14:20" / "Hôm qua, 19:30" / "dd/MM/yyyy, HH:mm" in local time. */
export function formatTxnDateLabel(date: Date, now: Date): string {
  const time = `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  const dayStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((dayStart(now) - dayStart(date)) / 86_400_000);
  if (diffDays === 0) return `Hôm nay, ${time}`;
  if (diffDays === 1) return `Hôm qua, ${time}`;
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}, ${time}`;
}
