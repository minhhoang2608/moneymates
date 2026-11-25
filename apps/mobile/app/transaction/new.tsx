import { useLocalSearchParams, useRouter } from "expo-router";

import { TransactionForm } from "@/components/transaction/TransactionForm";
import { vi } from "@/i18n/vi";
import { billDateToLocal } from "@/lib/bill/billResult";

type Params = {
  transactionId?: string;
  groupId?: string;
  amount?: string;
  note?: string;
  categoryId?: string;
  payerMemberId?: string;
  source?: string;
  aiError?: string;
  date?: string;
  attachmentUri?: string;
};

function receiptDate(iso: string | undefined): Date {
  const d = iso ? new Date(iso) : new Date();
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

export default function NewTransactionScreen() {
  const router = useRouter();
  const p = useLocalSearchParams<Params>();
  const voice = p.source === "voice";
  const bill = p.source === "bill";
  const receipt = p.source === "receipt";
  const amount = /^\d+$/.test(p.amount ?? "") ? Number(p.amount) : null;
  const aiError = p.aiError && p.aiError in vi.apiErrors ? (p.aiError as keyof typeof vi.apiErrors) : null;
  return (
    <TransactionForm
      transactionId={p.transactionId}
      groupId={p.groupId}
      onClose={() => router.back()}
      source={voice ? "voice" : bill ? "bill" : receipt ? "receipt" : "manual"}
      initial={
        voice || bill || receipt
          ? {
              amountVnd: amount,
              note: p.note ?? "",
              categoryId: p.categoryId || null,
              payerMemberId: p.payerMemberId || null,
              ...(bill ? { occurredAt: billDateToLocal(p.date, new Date()), photoUri: p.attachmentUri || null } : {}),
              ...(receipt ? { occurredAt: receiptDate(p.date), photoUri: p.attachmentUri || null } : {}),
            }
          : undefined
      }
      notice={voice && aiError ? vi.apiErrors[aiError] : undefined}
    />
  );
}
