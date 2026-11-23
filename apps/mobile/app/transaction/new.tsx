import { useLocalSearchParams, useRouter } from "expo-router";

import { TransactionForm } from "@/components/transaction/TransactionForm";
import { vi } from "@/i18n/vi";

type Params = {
  groupId?: string;
  amount?: string;
  note?: string;
  categoryId?: string;
  payerMemberId?: string;
  source?: string;
  aiError?: string;
};

export default function NewTransactionScreen() {
  const router = useRouter();
  const p = useLocalSearchParams<Params>();
  const voice = p.source === "voice";
  const amount = /^\d+$/.test(p.amount ?? "") ? Number(p.amount) : null;
  const aiError = p.aiError && p.aiError in vi.apiErrors ? (p.aiError as keyof typeof vi.apiErrors) : null;
  return (
    <TransactionForm
      groupId={p.groupId}
      onClose={() => router.back()}
      source={voice ? "voice" : "manual"}
      initial={
        voice
          ? {
              amountVnd: amount,
              note: p.note ?? "",
              categoryId: p.categoryId || null,
              payerMemberId: p.payerMemberId || null,
            }
          : undefined
      }
      notice={voice && aiError ? vi.apiErrors[aiError] : undefined}
    />
  );
}
