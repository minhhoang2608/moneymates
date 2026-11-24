import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { PressableScale } from "@/components/PressableScale";
import { CheckIcon, CloseIcon } from "@/components/icons";
import { vi } from "@/i18n/vi";
import { colors, fontFamily, fontSize, radii } from "@/theme";

type Props = {
  appNames: string[];
  onContinue: () => void;
  onLater: () => void;
  onClose: () => void;
};

/** Explainer shown before sending the user to Android's notification-access page. Presentational only. */
export function NotifAccessExplainer({ appNames, onContinue, onLater, onClose }: Props) {
  const t = vi.notifAccess;
  const bullets = [t.appsLine(appNames), t.onDevice, t.turnOff];
  return (
    <SafeAreaView style={styles.screen} testID="screen-notif-access">
      <View style={styles.header}>
        <PressableScale
          testID="notif-access-close"
          accessibilityRole="button"
          accessibilityLabel={t.close}
          style={styles.iconBtn}
          onPress={onClose}
        >
          <CloseIcon color={colors.text} size={22} />
        </PressableScale>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.illustration} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <View style={styles.notif}>
            <View style={styles.notifIcon}>
              <Text style={styles.notifIconText}>TP</Text>
            </View>
            <View style={styles.flex}>
              <Text style={styles.notifTitle}>{t.sampleTitle}</Text>
              <Text style={styles.notifBody}>{t.sampleBody}</Text>
            </View>
          </View>
          <View style={styles.match}>
            <CheckIcon color={colors.primaryDark} size={18} />
            <Text style={styles.matchText}>{t.sampleMatch}</Text>
          </View>
        </View>
        <View style={styles.copy}>
          <Text style={styles.title}>{t.title}</Text>
          <Text style={styles.body}>{t.body}</Text>
        </View>
        <View style={styles.list}>
          {bullets.map((line, i) => (
            <View key={i} style={styles.bullet}>
              <Text style={styles.tick}>✓</Text>
              <Text style={styles.bulletText} testID={i === 0 ? "notif-access-apps" : undefined}>
                {line}
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>
      <View style={styles.footer}>
        <PressableScale
          testID="notif-access-continue"
          accessibilityRole="button"
          style={styles.cta}
          onPress={onContinue}
        >
          <Text style={styles.ctaText}>{t.continue}</Text>
        </PressableScale>
        <PressableScale testID="notif-access-later" accessibilityRole="button" style={styles.later} onPress={onLater}>
          <Text style={styles.laterText}>{t.later}</Text>
        </PressableScale>
        <Text style={styles.footnote}>{t.footnote}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: { height: 64, paddingHorizontal: 12, justifyContent: "center" },
  iconBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  content: { paddingHorizontal: 20, paddingBottom: 24, gap: 20 },
  flex: { flex: 1, gap: 2 },
  illustration: {
    backgroundColor: colors.primarySoft,
    borderRadius: 20,
    paddingVertical: 24,
    paddingHorizontal: 16,
    gap: 10,
  },
  notif: {
    flexDirection: "row",
    gap: 10,
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 12,
    shadowColor: "#111827",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  notifIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.bankTpbBg,
    alignItems: "center",
    justifyContent: "center",
  },
  notifIconText: { fontFamily: fontFamily.bold, fontSize: 11, color: colors.bankTpbFg },
  notifTitle: { fontFamily: fontFamily.semibold, fontSize: 12, color: colors.text },
  notifBody: { fontFamily: fontFamily.regular, fontSize: 12, lineHeight: 17, color: colors.textMuted },
  match: { flexDirection: "row", alignItems: "center", gap: 8, paddingLeft: 6 },
  matchText: { flex: 1, fontFamily: fontFamily.semibold, fontSize: 13, color: colors.primaryDark },
  copy: { gap: 8 },
  title: { fontFamily: fontFamily.bold, fontSize: 22, color: colors.text },
  body: { fontFamily: fontFamily.regular, fontSize: fontSize.body, lineHeight: 21, color: colors.textMuted },
  list: { gap: 12 },
  bullet: { flexDirection: "row", gap: 10 },
  tick: { fontFamily: fontFamily.bold, fontSize: 13, color: colors.primary },
  bulletText: { flex: 1, fontFamily: fontFamily.regular, fontSize: 13, lineHeight: 19, color: colors.text },
  footer: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    gap: 8,
  },
  cta: {
    height: 54,
    borderRadius: radii.button,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaText: { fontFamily: fontFamily.semibold, fontSize: 16, color: colors.onPrimary },
  later: { height: 44, alignItems: "center", justifyContent: "center" },
  laterText: { fontFamily: fontFamily.semibold, fontSize: 15, color: colors.text },
  footnote: { fontFamily: fontFamily.regular, fontSize: 12, color: colors.textMuted, textAlign: "center" },
});
