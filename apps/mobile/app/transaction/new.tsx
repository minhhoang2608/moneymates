import { useLocalSearchParams, useRouter } from "expo-router";

import { TransactionForm } from "@/components/transaction/TransactionForm";

export default function TransactionFormScreen() {
  const router = useRouter();
  const { transactionId, groupId } = useLocalSearchParams<{ transactionId?: string; groupId?: string }>();
  return <TransactionForm transactionId={transactionId} groupId={groupId} onClose={() => router.back()} />;
}
