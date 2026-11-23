import { StyleSheet, View } from "react-native";
import QRCode from "react-native-qrcode-svg";

import { colors, radii } from "@/theme";

export function AccountQrPreview({ payload }: { payload: string }) {
  return (
    <View testID="account-qr" accessibilityLabel={payload} style={styles.card}>
      <QRCode value={payload} size={200} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignSelf: "center",
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
