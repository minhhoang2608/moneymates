import { useLocalSearchParams } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { vi } from "@/i18n/vi";
import { formatVnd } from "@/lib/money";
import { colors, fontFamily, fontSize, layout } from "@/theme";

// Minimal stub: the payment-confirm ticket replaces it. Params are strings from /scan.
export default function PayConfirmScreen() {
  const p = useLocalSearchParams<Record<string, string>>();
  return (
    <View style={styles.root} testID="screen-pay-confirm">
      <Text style={styles.title}>{vi.payConfirm.title}</Text>
      {p.bankName ? <Text testID="pay-confirm-bank">{p.bankName}</Text> : null}
      {p.account ? <Text testID="pay-confirm-account">{p.account}</Text> : null}
      {p.amount ? <Text testID="pay-confirm-amount">{formatVnd(Number(p.amount))}</Text> : null}
      {p.message ? <Text testID="pay-confirm-message">{p.message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: layout.screenPadding, backgroundColor: colors.background, gap: 8 },
  title: { fontFamily: fontFamily.bold, fontSize: fontSize.heading, color: colors.text },
});
