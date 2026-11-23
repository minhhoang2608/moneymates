import { useLocalSearchParams, useRouter } from "expo-router";

import { TransactionForm } from "@/components/transaction/TransactionForm";

export default function TransactionFormScreen() {
  const router = useRouter();
  const { transactionId } = useLocalSearchParams<{ transactionId?: string }>();
  return <TransactionForm transactionId={transactionId} onClose={() => router.back()} />;
}
