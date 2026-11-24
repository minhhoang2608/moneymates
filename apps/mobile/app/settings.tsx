import Constants from "expo-constants";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";

import { DefaultBankSuggestion } from "@/components/settings/DefaultBankSuggestion";
import { MoneySourceSection } from "@/components/settings/MoneySourceSection";
import { PaymentAppList } from "@/components/settings/PaymentAppList";
import { useRepositories } from "@/db/RepositoriesProvider";
import type { MoneySourceRow } from "@/db/repositories/moneySourceRepository";
import { vi } from "@/i18n/vi";
import { getAppLockAuth } from "@/lib/appLock/auth";
import { PAY_APPS, orderAppsBySaved } from "@/lib/payConfirm/apps";
import { suggestDefaultApp } from "@/lib/payConfirm/defaultSuggestion";
import { PREF_KEYS } from "@/lib/preferences/defaults";
import { useAppLock } from "@/stores/appLock";
import { colors, fontFamily, fontSize, layout, radii } from "@/theme";

export default function SettingsScreen() {
  const router = useRouter();
  const { paymentAppPrefs, moneySources, preferences, appSettings, bankAccounts, handOffMemory } = useRepositories();
  const [order, setOrder] = useState<string[]>([]);
  const [sources, setSources] = useState<MoneySourceRow[]>([]);
  const [currency, setCurrency] = useState("VND");
  const [alertOn, setAlertOn] = useState(true);
  const [lockOn, setLockOn] = useState(false);
  const [lockAvailable, setLockAvailable] = useState(true);
  const [lockBusy, setLockBusy] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const [accountBins, setAccountBins] = useState<string[]>([]);
  const [dismissed, setDismissed] = useState(true);

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

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        const [o, s, c, a, l, avail, rec, accounts, dis] = await Promise.all([
          paymentAppPrefs.getAppOrder(),
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
        ]);
        if (!alive) return;
        setOrder(o);
        setSources(s);
        setCurrency(c);
        setAlertOn(a);
        setLockOn(l);
        setLockAvailable(avail);
        setRecent(Array.isArray(rec) ? rec : []);
        setAccountBins(accounts.map((x) => x.bank_bin));
        setDismissed(dis);
      })();
      return () => {
        alive = false;
      };
    }, [paymentAppPrefs, moneySources, preferences, appSettings, bankAccounts, handOffMemory]),
  );

  const fullOrder = orderAppsBySaved(PAY_APPS, order).map((a) => a.id);
  const suggestedId = suggestDefaultApp({ order: fullOrder, recent, accountBins, dismissed });
  const suggested = PAY_APPS.find((a) => a.id === suggestedId);

  const version = Constants.expoConfig?.version ?? "";

  return (
    <View style={styles.root} testID="screen-settings">
      <View style={styles.header}>
        <Pressable
          testID="settings-back"
          accessibilityRole="button"
          accessibilityLabel={vi.settings.back}
          onPress={() => router.back()}
          style={styles.iconBtn}
        >
          <Text style={styles.back}>‹</Text>
        </Pressable>
        <Text style={styles.title}>{vi.settings.title}</Text>
      </View>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Text style={styles.section}>{vi.settings.appsHeading}</Text>
        {suggested ? (
          <DefaultBankSuggestion
            appName={suggested.name}
            onAccept={() => {
              const keys = [suggested.id, ...fullOrder.filter((id) => id !== suggested.id)];
              setOrder(keys);
              void paymentAppPrefs.setAppOrder(keys);
            }}
            onDismiss={() => {
              setDismissed(true);
              void handOffMemory.dismissDefaultSuggestion();
            }}
          />
        ) : null}
        <PaymentAppList
          order={order}
          onChange={(keys) => {
            setOrder(keys);
            void paymentAppPrefs.setAppOrder(keys);
          }}
        />

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
