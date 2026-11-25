import type { ReactNode } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { PressableScale } from "@/components/PressableScale";
import { vi } from "@/i18n/vi";
import { colors, fontFamily, fontSize, radii } from "@/theme";

type Props = {
  step: 1 | 2 | 3 | 4;
  onNext: () => void;
  onSkip: () => void;
  children: ReactNode;
  testID?: string;
};

/** Shared shell of onboarding steps: "Bước N/4", "Để sau", progress bar, content, "Tiếp tục". */
export function OnboardingStep({ step, onNext, onSkip, children, testID }: Props) {
  const t = vi.onboarding;
  return (
    <SafeAreaView style={styles.screen} testID={testID}>
      <View style={styles.header}>
        <View style={styles.side} />
        <Text style={styles.step}>{t.step(step)}</Text>
        <PressableScale testID="onb-skip" accessibilityRole="button" style={styles.skip} onPress={onSkip}>
          <Text style={styles.skipText}>{t.skip}</Text>
        </PressableScale>
      </View>
      <View style={styles.progress} accessibilityElementsHidden>
        {[1, 2, 3, 4].map((i) => (
          <View key={i} style={[styles.bar, i <= step && styles.barOn]} />
        ))}
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
      <View style={styles.footer}>
        <PressableScale testID="onb-next" accessibilityRole="button" style={styles.cta} onPress={onNext}>
          <Text style={styles.ctaText}>{t.next}</Text>
        </PressableScale>
      </View>
    </SafeAreaView>
  );
}

export const onboardingTextStyles = StyleSheet.create({
  title: { fontFamily: fontFamily.bold, fontSize: fontSize.heading, color: colors.text },
  subtitle: { fontFamily: fontFamily.regular, fontSize: fontSize.body, lineHeight: 21, color: colors.textMuted },
});

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: {
    height: 64,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  side: { width: 44, height: 44 },
  step: { fontFamily: fontFamily.semibold, fontSize: 13, color: colors.textMuted },
  skip: { minWidth: 44, height: 44, paddingHorizontal: 8, alignItems: "center", justifyContent: "center" },
  skipText: { fontFamily: fontFamily.semibold, fontSize: fontSize.body, color: colors.primary },
  progress: { flexDirection: "row", gap: 6, paddingHorizontal: 20 },
  bar: { flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.border },
  barOn: { backgroundColor: colors.primary },
  content: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 24, gap: 6 },
  footer: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
  },
  cta: {
    height: 54,
    borderRadius: radii.button,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaText: { fontFamily: fontFamily.semibold, fontSize: 16, color: colors.onPrimary },
});
