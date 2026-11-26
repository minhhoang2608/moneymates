import { usePayApps } from "@/api/bankApps";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";

import { OnboardingStep, onboardingTextStyles } from "@/components/onboarding/OnboardingStep";
import { PressableScale } from "@/components/PressableScale";
import { PaymentAppRow } from "@/components/settings/PaymentAppRow";
import { useEnabledPayApps } from "@/hooks/useEnabledPayApps";
import { vi } from "@/i18n/vi";
import { FEATURED_APP_IDS, searchApps, type PayApp } from "@/lib/payConfirm/apps";
import { getInstalledPayApps } from "@/lib/payConfirm/getInstalledPayApps";
import { colors, fontFamily, fontSize, radii } from "@/theme";

/** Onboarding step 2/4: pick the payment apps. Nothing is written until "Tiếp tục". */
export default function OnboardingAppsScreen() {
  const payApps = usePayApps();
  const router = useRouter();
  const { reorder } = useEnabledPayApps();
  const t = vi.onboarding.apps;
  const [selected, setSelected] = useState<string[]>([]);
  const [installed, setInstalled] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    let alive = true;
    getInstalledPayApps().then((ids) => {
      if (!alive) return;
      setInstalled(ids);
      // Keep anything the user already tapped before detection finished.
      setSelected((cur) => [...ids.filter((id) => !cur.includes(id)), ...cur]);
    });
    return () => {
      alive = false;
    };
  }, []);

  const visible = useMemo(() => {
    const found = searchApps(payApps, query);
    if (query.trim() || showAll) return found;
    return found.filter((a) => FEATURED_APP_IDS.includes(a.id) || installed.includes(a.id) || selected.includes(a.id));
  }, [payApps, query, showAll, installed, selected]);

  const toggle = (id: string, on: boolean) =>
    setSelected((cur) => (on ? (cur.includes(id) ? cur : [...cur, id]) : cur.filter((x) => x !== id)));

  const next = async () => {
    // Saving an empty set would leave pay-confirm with no hand-off apps: treat it like "Để sau".
    if (selected.length > 0) await reorder(selected).catch(() => undefined);
    router.push("/onboarding/permissions");
  };
  const skip = () => router.push("/onboarding/permissions");

  const group = (title: string, apps: PayApp[]) =>
    apps.length === 0 ? null : (
      <>
        <Text style={styles.group}>{title}</Text>
        <View style={styles.card}>
          {apps.map((a, i) => (
            <PaymentAppRow
              key={a.id}
              app={a}
              on={selected.includes(a.id)}
              last={i === apps.length - 1}
              control="check"
              onToggle={(on) => toggle(a.id, on)}
            />
          ))}
        </View>
      </>
    );

  return (
    <OnboardingStep
      step={2}
      onNext={next}
      onSkip={skip}
      testID="onboarding-apps"
      nextLabel={selected.length > 0 ? t.next(selected.length) : undefined}
    >
      <Text style={onboardingTextStyles.title}>{vi.onboarding.apps.title}</Text>
      <Text style={onboardingTextStyles.subtitle}>{t.subtitle}</Text>
      <View style={styles.body}>
        <TextInput
          testID="onb-apps-search"
          accessibilityLabel={t.searchLabel}
          placeholder={t.searchPlaceholder}
          placeholderTextColor={colors.textMuted}
          value={query}
          onChangeText={setQuery}
          style={styles.search}
        />
        {group(
          t.autofillGroup,
          visible.filter((a) => a.supportsAutofill),
        )}
        {group(
          t.scanGroup,
          visible.filter((a) => !a.supportsAutofill),
        )}
        {!showAll && !query.trim() ? (
          <PressableScale testID="onb-apps-show-all" accessibilityRole="button" onPress={() => setShowAll(true)}>
            <Text style={styles.link}>{t.showAll}</Text>
          </PressableScale>
        ) : null}
      </View>
    </OnboardingStep>
  );
}

const styles = StyleSheet.create({
  body: { paddingTop: 10, gap: 10 },
  search: {
    height: 44,
    borderRadius: radii.input,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    fontFamily: fontFamily.regular,
    fontSize: fontSize.body,
    color: colors.text,
  },
  group: { marginTop: 4, fontFamily: fontFamily.semibold, fontSize: 13, color: colors.textMuted },
  card: { backgroundColor: colors.surface, borderRadius: radii.card, overflow: "hidden" },
  link: { fontFamily: fontFamily.semibold, fontSize: 13, color: colors.primary },
});
