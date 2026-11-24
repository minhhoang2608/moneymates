import { StyleSheet, Text, View } from "react-native";
import { PressableScale } from "@/components/PressableScale";

import { vi } from "@/i18n/vi";
import { colors, fontFamily, fontSize, radii } from "@/theme";

type Props = { appName: string; onAccept: () => void; onDismiss: () => void };

/** Offers an autofill bank as the default hand-off app. */
export function DefaultBankSuggestion({ appName, onAccept, onDismiss }: Props) {
  return (
    <View style={styles.card} testID="settings-default-suggest">
      <Text style={styles.text}>{vi.settings.suggestDefault(appName)}</Text>
      <View style={styles.actions}>
        <PressableScale
          testID="settings-default-suggest-dismiss"
          accessibilityRole="button"
          onPress={onDismiss}
          hitSlop={8}
        >
          <Text style={styles.dismiss}>{vi.settings.suggestDismiss}</Text>
        </PressableScale>
        <PressableScale
          testID="settings-default-suggest-accept"
          accessibilityRole="button"
          onPress={onAccept}
          hitSlop={8}
        >
          <Text style={styles.accept}>{vi.settings.suggestAccept}</Text>
        </PressableScale>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.primarySoft, borderRadius: radii.card, padding: 14, gap: 10 },
  text: { fontFamily: fontFamily.regular, fontSize: fontSize.secondary, color: colors.text },
  actions: { flexDirection: "row", justifyContent: "flex-end", gap: 20 },
  dismiss: { fontFamily: fontFamily.medium, fontSize: fontSize.body, color: colors.textMuted },
  accept: { fontFamily: fontFamily.bold, fontSize: fontSize.body, color: colors.primaryDark },
});
