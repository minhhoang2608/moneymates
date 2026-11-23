import { Image, Pressable, StyleSheet, Text, View } from "react-native";

import { vi } from "@/i18n/vi";
import { colors, fontFamily, fontSize, radii } from "@/theme";

export function LockScreen({ onRetry }: { onRetry: () => void }) {
  return (
    <View testID="app-lock-screen" style={styles.root}>
      <Image source={require("../../../assets/icon.png")} style={styles.logo} />
      <Text style={styles.title}>{vi.appLock.title}</Text>
      <Text style={styles.subtitle}>{vi.appLock.subtitle}</Text>
      <Pressable testID="app-lock-retry" accessibilityRole="button" onPress={onRetry} style={styles.button}>
        <Text style={styles.buttonText}>{vi.appLock.retry}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  logo: { width: 88, height: 88, borderRadius: radii.card, marginBottom: 24 },
  title: { fontFamily: fontFamily.bold, fontSize: fontSize.heading, color: colors.text, textAlign: "center" },
  subtitle: { fontFamily: fontFamily.regular, color: colors.textMuted, marginTop: 8, textAlign: "center" },
  button: {
    marginTop: 28,
    backgroundColor: colors.primary,
    borderRadius: radii.button,
    paddingVertical: 14,
    paddingHorizontal: 32,
  },
  buttonText: { fontFamily: fontFamily.semibold, color: colors.onPrimary },
});
