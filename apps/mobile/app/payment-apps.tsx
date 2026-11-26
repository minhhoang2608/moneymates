import { usePayApps } from "@/api/bankApps";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { PressableScale } from "@/components/PressableScale";
import { EnabledAppList } from "@/components/settings/EnabledAppList";
import { PaymentAppRow } from "@/components/settings/PaymentAppRow";
import { useEnabledPayApps } from "@/hooks/useEnabledPayApps";
import { vi } from "@/i18n/vi";
import { searchApps, type PayApp } from "@/lib/payConfirm/apps";
import { partitionApps } from "@/lib/payConfirm/enabledApps";
import { colors, fontFamily, fontSize, layout, radii } from "@/theme";

function Group({ apps, enabled, onToggle }: { apps: PayApp[]; enabled: Set<string>; onToggle: Props["onToggle"] }) {
  return (
    <View style={styles.card}>
      {apps.map((a, i) => (
        <PaymentAppRow
          key={a.id}
          app={a}
          on={enabled.has(a.id)}
          last={i === apps.length - 1}
          onToggle={(on) => onToggle(a.id, on)}
        />
      ))}
    </View>
  );
}
type Props = { onToggle: (id: string, on: boolean) => void };

export default function PaymentAppsScreen() {
  const payApps = usePayApps();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { enabled, ready, toggle, reorder } = useEnabledPayApps();
  const [query, setQuery] = useState("");
  const searching = query.trim().length > 0;
  const enabledSet = new Set(enabled);
  const { enabled: enabledApps, banks, wallets } = partitionApps(payApps, enabled);
  const found = searching ? searchApps(payApps, query) : [];
  const onToggle = (id: string, on: boolean) => void toggle(id, on);

  return (
    <View style={styles.root} testID="screen-payment-apps">
      <View testID="payment-apps-header" style={[styles.header, { paddingTop: insets.top, height: 64 + insets.top }]}>
        <PressableScale
          testID="payment-apps-back"
          accessibilityRole="button"
          accessibilityLabel={vi.paymentApps.back}
          onPress={() => router.back()}
          style={styles.iconBtn}
        >
          <Text style={styles.back}>‹</Text>
        </PressableScale>
        <Text style={styles.title}>{vi.paymentApps.title}</Text>
      </View>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Text style={styles.intro}>{vi.paymentApps.intro}</Text>
        <View style={styles.search}>
          <TextInput
            testID="payment-apps-search"
            accessibilityLabel={vi.paymentApps.searchLabel}
            placeholder={vi.paymentApps.searchPlaceholder}
            placeholderTextColor={colors.textMuted}
            value={query}
            onChangeText={setQuery}
            autoCorrect={false}
            style={styles.input}
          />
        </View>
        {!ready ? null : searching ? (
          found.length > 0 ? (
            <Group apps={found} enabled={enabledSet} onToggle={onToggle} />
          ) : (
            <Text style={styles.intro}>{vi.paymentApps.noResults}</Text>
          )
        ) : (
          <>
            {enabledApps.length > 0 ? (
              <>
                <Text testID="payment-apps-enabled-heading" style={styles.section}>
                  {vi.paymentApps.enabledHeading(enabledApps.length)}
                </Text>
                <EnabledAppList apps={enabledApps} onReorder={(ids) => void reorder(ids)} onToggle={onToggle} />
              </>
            ) : null}
            {banks.length > 0 ? (
              <>
                <Text style={styles.section}>{vi.paymentApps.banks}</Text>
                <Group apps={banks} enabled={enabledSet} onToggle={onToggle} />
              </>
            ) : null}
            {wallets.length > 0 ? (
              <>
                <Text style={styles.section}>{vi.paymentApps.wallets}</Text>
                <Group apps={wallets} enabled={enabledSet} onToggle={onToggle} />
              </>
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { height: 64, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 8 },
  iconBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  back: { fontSize: 30, color: colors.text },
  title: { flex: 1, fontFamily: fontFamily.semibold, fontSize: fontSize.title, color: colors.text },
  body: { paddingHorizontal: layout.screenPadding, gap: 10, paddingBottom: 32 },
  intro: { fontFamily: fontFamily.regular, fontSize: fontSize.secondary, lineHeight: 19, color: colors.textMuted },
  search: {
    height: 44,
    borderRadius: radii.input,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    justifyContent: "center",
  },
  input: { fontFamily: fontFamily.regular, fontSize: fontSize.body, color: colors.text, padding: 0 },
  section: { marginTop: 4, fontFamily: fontFamily.semibold, fontSize: fontSize.secondary, color: colors.textMuted },
  card: { backgroundColor: colors.surface, borderRadius: radii.card, overflow: "hidden", paddingHorizontal: 14 },
});
