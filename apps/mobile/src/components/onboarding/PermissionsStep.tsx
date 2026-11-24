import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { PressableScale } from "@/components/PressableScale";
import { CameraIcon, ImageIcon, MicIcon } from "@/components/icons";
import { PermissionRow } from "@/components/onboarding/PermissionRow";
import { usePermissionRows } from "@/hooks/usePermissionRows";
import { vi } from "@/i18n/vi";
import { openAppSettings, type PermissionKind } from "@/lib/permissions";
import { colors, fontFamily, fontSize, radii } from "@/theme";

type Props = {
  onNext: () => void;
  onSkip: () => void;
};

const ROWS: { kind: PermissionKind; Icon: typeof CameraIcon }[] = [
  { kind: "camera", Icon: CameraIcon },
  { kind: "photos", Icon: ImageIcon },
  { kind: "microphone", Icon: MicIcon },
];

/** Onboarding step 3/4 (the Android bank-notification row is added by #340): each permission is requested only when its own "Tiếp tục" is tapped. */
export function PermissionsStep({ onNext, onSkip }: Props) {
  const t = vi.onboarding.permissions;
  const { rows, ask } = usePermissionRows();
  return (
    <SafeAreaView style={styles.screen} testID="onboarding-permissions">
      <View style={styles.header}>
        <Text style={styles.step}>{t.step}</Text>
        <PressableScale testID="perm-skip" accessibilityRole="button" style={styles.skip} onPress={onSkip}>
          <Text style={styles.skipText}>{t.skip}</Text>
        </PressableScale>
      </View>
      <View style={styles.progress} accessibilityElementsHidden>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={[styles.bar, i < 3 && styles.barOn]} />
        ))}
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>{t.title}</Text>
        <Text style={styles.subtitle}>{t.subtitle}</Text>
        <View style={styles.card}>
          {ROWS.map(({ kind, Icon }, i) => (
            <PermissionRow
              key={kind}
              id={kind}
              icon={<Icon color={colors.primary} size={22} />}
              label={t[kind].label}
              description={t[kind].description}
              state={rows[kind]?.state}
              last={i === ROWS.length - 1}
              onAsk={() => void ask(kind)}
              onOpenSettings={() => void openAppSettings()}
            />
          ))}
        </View>
        <Text style={styles.footnote}>{t.footnote}</Text>
      </ScrollView>
      <View style={styles.footer}>
        <PressableScale testID="perm-next" accessibilityRole="button" style={styles.cta} onPress={onNext}>
          <Text style={styles.ctaText}>{t.next}</Text>
        </PressableScale>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: {
    height: 64,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  step: { fontFamily: fontFamily.semibold, fontSize: 13, color: colors.textMuted },
  skip: { minWidth: 44, height: 44, alignItems: "center", justifyContent: "center" },
  skipText: { fontFamily: fontFamily.semibold, fontSize: fontSize.body, color: colors.primary },
  progress: { flexDirection: "row", gap: 6, paddingHorizontal: 20 },
  bar: { flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.border },
  barOn: { backgroundColor: colors.primary },
  content: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 24, gap: 10 },
  title: { fontFamily: fontFamily.bold, fontSize: fontSize.heading, color: colors.text },
  subtitle: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.body,
    lineHeight: 21,
    color: colors.textMuted,
    marginBottom: 6,
  },
  card: { backgroundColor: colors.surface, borderRadius: radii.card, overflow: "hidden" },
  footnote: {
    fontFamily: fontFamily.regular,
    fontSize: 12,
    lineHeight: 18,
    color: colors.textMuted,
  },
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
