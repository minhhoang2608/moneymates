import { useSafeAreaInsets } from "react-native-safe-area-context";
import Constants from "expo-constants";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Platform, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { PressableScale } from "@/components/PressableScale";

import { DefaultBankSuggestion } from "@/components/settings/DefaultBankSuggestion";
import { MoneySourceSection } from "@/components/settings/MoneySourceSection";
import { useRepositories } from "@/db/RepositoriesProvider";
import type { MoneySourceRow } from "@/db/repositories/moneySourceRepository";
import { isAccessGranted } from "../modules/notification-listener";
import { useEnabledPayApps } from "@/hooks/useEnabledPayApps";
import { vi } from "@/i18n/vi";
import { getAppLockAuth } from "@/lib/appLock/auth";
import { PAY_APPS } from "@/lib/payConfirm/apps";
import { suggestDefaultApp } from "@/lib/payConfirm/defaultSuggestion";
import { SheetPicker } from "@/components/transaction/SheetPicker";
import { DEFAULT_NON_AUTOFILL_MODE, PREF_KEYS, type NonAutofillMode } from "@/lib/preferences/defaults";
import { useAppLock } from "@/stores/appLock";
import { useAutoDetect } from "@/stores/autoDetect";
import { colors, fontFamily, fontSize, layout, radii } from "@/theme";

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { moneySources, preferences, appSettings, bankAccounts, handOffMemory } = useRepositories();
  const { enabled, reorder, reload } = useEnabledPayApps();
  const [sources, setSources] = useState<MoneySourceRow[]>([]);
  const [currency, setCurrency] = useState("VND");
  const [alertOn, setAlertOn] = useState(true);
  const [lockOn, setLockOn] = useState(false);
  const [lockAvailable, setLockAvailable] = useState(true);
  const [lockBusy, setLockBusy] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const [accountBins, setAccountBins] = useState<string[]>([]);
  const [dismissed, setDismissed] = useState(true);
  const [nonAutofill, setNonAutofill] = useState<NonAutofillMode>(DEFAULT_NON_AUTOFILL_MODE);
  const [modeOpen, setModeOpen] = useState(false);
  const [autoDetect, setAutoDetect] = useState(false);
  const isAndroid = Platform.OS === "android";
  const modeLabel = (m: NonAutofillMode) =>
    m === "no_image" ? vi.settings.nonAutofillNoImage : vi.settings.nonAutofillQrImage;

  const onLockChange = async (v: boolean) => {
    if (!v) {
      setLockOn(false);
      await preferences.setAppLockEnabled(false);
      useAppLock.getState().setEnabled(false);
      return;
    }
    setLockOn(true);
    setLockBusy(true);
    try {
      let ok = false;
      try {
        const auth = getAppLockAuth();
        if (await auth.isLockAvailable()) {
          ok = await auth.authenticate();
        } else {
          setLockAvailable(false);
        }
      } catch {
        ok = false;
      }
      if (ok) {
        await preferences.setAppLockEnabled(true);
        useAppLock.getState().setEnabled(true);
      } else {
        setLockOn(false);
      }
    } finally {
      setLockBusy(false);
    }
  };

  const onAutoDetectChange = (v: boolean) => {
    if (v) {
      router.push("/notif-access");
      return;
    }
    setAutoDetect(false);
    void preferences.setAutoDetectTransfers(false).then(() => useAutoDetect.getState().bump());
  };

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      void reload().catch(() => {});
      (async () => {
        const [s, c, a, l, avail, rec, accounts, dis, mode] = await Promise.all([
          moneySources.listSources(),
          preferences.getDefaultCurrency(),
          preferences.getAlertOverLastMonth(),
          preferences.getAppLockEnabled(),
          getAppLockAuth()
            .isLockAvailable()
            .catch(() => false),
          appSettings.get<string[]>(PREF_KEYS.recentPayApps),
          bankAccounts.listAccounts(),
          handOffMemory.getDefaultSuggestionDismissed(),
          preferences.getNonAutofillMode(),
        ]);
        if (isAndroid) {
          const saved = await preferences.getAutoDetectTransfers();
          const granted = saved ? await isAccessGranted().catch(() => false) : false;
          if (saved && !granted) {
            await preferences.setAutoDetectTransfers(false);
            useAutoDetect.getState().bump();
          }
          if (alive) setAutoDetect(saved && granted);
        }
        if (!alive) return;
        setSources(s);
        setCurrency(c);
        setAlertOn(a);
        setLockOn(l);
        setLockAvailable(avail);
        setRecent(Array.isArray(rec) ? rec : []);
        setAccountBins(accounts.map((x) => x.bank_bin));
        setDismissed(dis);
        setNonAutofill(mode);
      })();
      return () => {
        alive = false;
      };
    }, [reload, moneySources, preferences, appSettings, bankAccounts, handOffMemory, isAndroid]),
  );

  const suggestedId = suggestDefaultApp({ order: enabled, recent, accountBins, dismissed });
  const suggested = PAY_APPS.find((a) => a.id === suggestedId);

  const version = Constants.expoConfig?.version ?? "";

  return (
    <View style={styles.root} testID="screen-settings">
      <View style={[styles.header, { paddingTop: insets.top, height: 64 + insets.top }]}>
        <PressableScale
          testID="settings-back"
          accessibilityRole="button"
          accessibilityLabel={vi.settings.back}
          onPress={() => router.back()}
          style={styles.iconBtn}
        >
          <Text style={styles.back}>‹</Text>
        </PressableScale>
        <Text style={styles.title}>{vi.settings.title}</Text>
      </View>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Text style={styles.section}>{vi.settings.paymentHeading}</Text>
        {suggested ? (
          <DefaultBankSuggestion
            appName={suggested.name}
            onAccept={() => {
              void reorder([suggested.id, ...enabled.filter((id) => id !== suggested.id)]);
            }}
            onDismiss={() => {
              setDismissed(true);
              void handOffMemory.dismissDefaultSuggestion();
            }}
          />
        ) : null}
        <View style={styles.card}>
          <PressableScale
            testID="settings-payment-apps-row"
            accessibilityRole="button"
            onPress={() => router.push("/payment-apps")}
            style={[styles.row, styles.divider]}
          >
            <Text style={styles.label}>{vi.settings.paymentAppsRow}</Text>
            <Text style={styles.value}>{vi.settings.enabledCount(enabled.length)}</Text>
          </PressableScale>
          <PressableScale
            testID="settings-non-autofill-row"
            accessibilityRole="button"
            onPress={() => setModeOpen(true)}
            style={[styles.row, isAndroid && styles.divider]}
          >
            <View style={styles.flex}>
              <Text style={styles.label}>{vi.settings.nonAutofillRow}</Text>
              <Text style={styles.hint}>{vi.settings.nonAutofillHint}</Text>
            </View>
            <Text style={styles.value} testID="settings-non-autofill-value">
              {`${modeLabel(nonAutofill)} ›`}
            </Text>
          </PressableScale>
          {isAndroid ? (
            <View style={styles.row} testID="settings-auto-detect-row">
              <View style={styles.flex}>
                <Text style={styles.label}>{vi.settings.autoDetect}</Text>
                <Text style={styles.hint}>{vi.settings.autoDetectHint}</Text>
              </View>
              <Switch
                testID="settings-auto-detect-toggle"
                accessibilityLabel={vi.settings.autoDetect}
                value={autoDetect}
                trackColor={{ true: colors.primary }}
                onValueChange={onAutoDetectChange}
              />
            </View>
          ) : null}
        </View>

        <Text testID="settings-general-heading" style={[styles.section, styles.sectionGap]}>
          {vi.settings.general}
        </Text>
        <View style={styles.card}>
          <View style={styles.divider}>
            <MoneySourceSection
              sources={sources}
              onAdd={async (name, kind) => {
                await moneySources.addSource(name, kind);
                setSources(await moneySources.listSources());
              }}
              onDelete={async (id) => {
                await moneySources.deleteSource(id);
                setSources(await moneySources.listSources());
              }}
            />
          </View>
          <View style={[styles.row, styles.divider]} testID="settings-currency">
            <Text style={styles.label}>{vi.settings.currency}</Text>
            <Text style={styles.value}>{currency}</Text>
          </View>
          <View style={[styles.row, styles.divider]}>
            <View style={styles.flex}>
              <Text style={styles.label}>{vi.settings.alert}</Text>
              <Text style={styles.hint}>{vi.settings.alertHint}</Text>
            </View>
            <Switch
              testID="settings-alert-toggle"
              accessibilityLabel={vi.settings.alert}
              value={alertOn}
              trackColor={{ true: colors.primary }}
              onValueChange={(v) => {
                setAlertOn(v);
                void preferences.setAlertOverLastMonth(v);
              }}
            />
          </View>
          <View style={styles.row}>
            <View style={styles.flex}>
              <Text style={styles.label}>{vi.settings.appLock}</Text>
              {!lockAvailable ? (
                <Text style={styles.hint} testID="settings-applock-unavailable">
                  {vi.settings.appLockUnavailable}
                </Text>
              ) : null}
            </View>
            <Switch
              testID="settings-applock-toggle"
              accessibilityLabel={vi.settings.appLock}
              value={lockOn}
              disabled={!lockAvailable || lockBusy}
              trackColor={{ true: colors.primary }}
              onValueChange={(v) => void onLockChange(v)}
            />
          </View>
        </View>

        <Text style={styles.footer} testID="settings-footer">
          {`${vi.settings.footer} ${version}`}
        </Text>
      </ScrollView>
      <SheetPicker
        visible={modeOpen}
        title={vi.settings.nonAutofillRow}
        options={(["qr_image", "no_image"] as const).map((m) => ({
          key: m,
          label: modeLabel(m),
          testID: `non-autofill-option-${m}`,
        }))}
        selectedKey={nonAutofill}
        onSelect={(k) => {
          const mode = k as NonAutofillMode;
          setNonAutofill(mode);
          setModeOpen(false);
          void preferences.setNonAutofillMode(mode);
        }}
        onClose={() => setModeOpen(false)}
      />
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
  section: { fontFamily: fontFamily.semibold, fontSize: fontSize.secondary, color: colors.textMuted },
  sectionGap: { marginTop: 8 },
  card: { backgroundColor: colors.surface, borderRadius: radii.card, paddingHorizontal: 16 },
  divider: { borderBottomWidth: 1, borderBottomColor: colors.divider },
  row: { minHeight: 52, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  flex: { flex: 1 },
  label: { fontFamily: fontFamily.regular, fontSize: fontSize.body, color: colors.text },
  value: { fontFamily: fontFamily.regular, fontSize: fontSize.secondary, color: colors.textMuted },
  hint: { fontFamily: fontFamily.regular, fontSize: fontSize.caption, color: colors.textMuted },
  footer: {
    textAlign: "center",
    paddingTop: 8,
    fontFamily: fontFamily.regular,
    fontSize: fontSize.caption,
    color: colors.textMuted,
  },
});
