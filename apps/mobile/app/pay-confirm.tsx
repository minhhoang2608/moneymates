import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "react-native-qrcode-svg";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { CategoryPicker } from "@/components/transaction/CategoryPicker";
import { useRepositories } from "@/db/RepositoriesProvider";
import type { CategoryRow } from "@/db/repositories";
import { vi } from "@/i18n/vi";
import { PAY_APPS, defaultAppId, orderApps } from "@/lib/payConfirm/apps";
import { buildQrExpense, canSubmit } from "@/lib/payConfirm/form";
import { makeHandOff } from "@/lib/payConfirm/handOffDeps";
import { parsePayConfirmParams } from "@/lib/payConfirm/params";
import { formatVnd, parseAmount } from "@/lib/money";
import { usePendingHandOff } from "@/stores/pendingHandOff";
import { colors, fontFamily, fontSize, layout, radii } from "@/theme";

const RECENT_KEY = "pay.recent_apps";
const OTHER_NAME = "Khác";

export default function PayConfirmScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<Record<string, string>>();
  const model = useMemo(() => parsePayConfirmParams(params), [params]);
  const { transactions, categories, appSettings } = useRepositories();

  const [amountText, setAmountText] = useState(model.amount !== undefined ? String(model.amount) : "");
  const [note, setNote] = useState(model.message ?? "");
  const [cats, setCats] = useState<CategoryRow[]>([]);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [picker, setPicker] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const [appId, setAppId] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const busy = useRef(false);
  const qrRef = useRef<{ toDataURL: (cb: (data: string) => void) => void } | null>(null);

  useEffect(() => {
    let alive = true;
    categories.listByKind("expense").then((rows) => {
      if (!alive) return;
      setCats(rows);
      setCategoryId((cur) => cur ?? rows.find((c) => c.name === OTHER_NAME)?.id ?? rows[0]?.id ?? null);
    });
    return () => {
      alive = false;
    };
  }, [categories]);

  useEffect(() => {
    let alive = true;
    appSettings.get<string[]>(RECENT_KEY).then((ids) => alive && setRecent(Array.isArray(ids) ? ids : []));
    return () => {
      alive = false;
    };
  }, [appSettings]);

  const apps = useMemo(() => orderApps(PAY_APPS, recent), [recent]);
  const selectedId = appId ?? defaultAppId(apps, recent, model.bankBin);
  const selected = apps.find((a) => a.id === selectedId) ?? apps[0];

  const parsed = parseAmount(amountText);
  const enabled = canSubmit(amountText) && categoryId !== null;
  const chips = useMemo(() => {
    const first = cats.slice(0, 3);
    const chosen = cats.find((c) => c.id === categoryId);
    return chosen && !first.includes(chosen) ? [...first.slice(0, 2), chosen] : first;
  }, [cats, categoryId]);

  const submit = async () => {
    if (busy.current || !parsed.ok || !categoryId) return;
    busy.current = true;
    setFailed(false);
    let txId: string;
    try {
      const tx = await transactions.create(buildQrExpense(model, { amount: parsed.vnd, categoryId, note }, new Date()));
      txId = tx.id;
    } catch {
      busy.current = false;
      setFailed(true);
      return;
    }
    try {
      await appSettings.set(RECENT_KEY, [selected.id, ...recent.filter((id) => id !== selected.id)].slice(0, 10));
      usePendingHandOff.getState().set({ txId, amount: parsed.vnd, label: note });
      const handOff = makeHandOff(
        () =>
          new Promise<string | null>((resolve) => {
            if (!qrRef.current) return resolve(null);
            qrRef.current.toDataURL((data) => resolve(data || null));
          }),
      );
      const { opened } = await handOff(selected, { model, amount: parsed.vnd, note });
      if (!opened) usePendingHandOff.getState().reveal();
    } catch {
      usePendingHandOff.getState().reveal();
    } finally {
      router.back();
    }
  };

  return (
    <View style={styles.root} testID="screen-pay-confirm">
      <View style={styles.header}>
        <Pressable
          testID="pay-back"
          accessibilityRole="button"
          accessibilityLabel={vi.payConfirm.back}
          onPress={() => router.back()}
          style={styles.back}
        >
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <Text style={styles.title}>{vi.payConfirm.title}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          {model.kind === "vietqr" ? (
            <View style={styles.recipient}>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{model.bankName.slice(0, 2).toUpperCase()}</Text>
              </View>
              <View style={styles.recipientText}>
                {model.name ? (
                  <Text testID="pay-confirm-name" style={styles.recipientName}>
                    {model.name}
                  </Text>
                ) : null}
                <Text testID="pay-confirm-bank" style={styles.muted}>
                  {`${model.bankName} · ${model.account}`}
                </Text>
              </View>
            </View>
          ) : null}
          <View style={model.kind === "vietqr" ? styles.amountBlock : undefined}>
            <Text style={styles.muted}>{vi.payConfirm.amount}</Text>
            <TextInput
              testID="pay-amount"
              value={amountText}
              onChangeText={setAmountText}
              keyboardType="numeric"
              autoFocus={model.amount === undefined}
              placeholder="0"
              placeholderTextColor={colors.neutral}
              style={styles.amountInput}
            />
            {model.amount !== undefined ? <Text style={styles.hint}>{vi.payConfirm.amountHint}</Text> : null}
          </View>
          <View style={styles.noteRow}>
            <Text style={styles.muted}>{vi.payConfirm.note}</Text>
            <TextInput testID="pay-note" value={note} onChangeText={setNote} style={styles.noteInput} />
          </View>
        </View>

        <Text style={styles.section}>{vi.payConfirm.category}</Text>
        <View style={styles.chips}>
          {chips.map((c) => {
            const on = c.id === categoryId;
            return (
              <Pressable
                key={c.id}
                testID={`pay-category-${c.id}`}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                onPress={() => setCategoryId(c.id)}
                style={[styles.chip, on && styles.chipOn]}
              >
                <Text style={[styles.chipText, on && styles.chipTextOn]}>{c.name}</Text>
              </Pressable>
            );
          })}
          <Pressable
            testID="pay-category-more"
            accessibilityRole="button"
            onPress={() => setPicker(true)}
            style={styles.chip}
          >
            <Text style={styles.chipText}>{vi.payConfirm.categoryMore}</Text>
          </Pressable>
        </View>

        <Text style={styles.section}>{vi.payConfirm.payWith}</Text>
        <View style={styles.appList}>
          {apps.map((a, i) => {
            const on = a.id === selected.id;
            return (
              <Pressable
                key={a.id}
                testID={`app-${a.id}`}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                onPress={() => setAppId(a.id)}
                style={[styles.appRow, on && styles.appRowOn, i > 0 && styles.appRowBorder]}
              >
                <View style={styles.appBadge}>
                  <Text style={styles.appBadgeText}>{a.short}</Text>
                </View>
                <Text style={[styles.appName, on && styles.appNameOn]}>{a.name}</Text>
                <Text style={styles.appMode}>
                  {a.supportsAutofill ? vi.payConfirm.autofill : vi.payConfirm.copyOpen}
                </Text>
                {on ? <Text style={styles.check}>✓</Text> : null}
              </Pressable>
            );
          })}
        </View>
        {failed ? (
          <Text testID="pay-error" style={styles.error}>
            {vi.payConfirm.saveFailed}
          </Text>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          testID="pay-submit"
          accessibilityRole="button"
          accessibilityState={{ disabled: !enabled }}
          disabled={!enabled}
          onPress={submit}
          style={[styles.submit, !enabled && styles.submitOff]}
        >
          <Text style={styles.submitText}>
            {parsed.ok
              ? vi.payConfirm.submit(formatVnd(parsed.vnd), selected.name)
              : vi.payConfirm.submitNoAmount(selected.name)}
          </Text>
        </Pressable>
        <Text style={styles.footNote}>{vi.payConfirm.saveNote}</Text>
      </View>

      <View style={styles.hiddenQr} pointerEvents="none" accessibilityElementsHidden>
        <QRCode value={model.payload || " "} size={300} getRef={(r) => (qrRef.current = r)} />
      </View>

      <CategoryPicker
        visible={picker}
        categories={cats}
        selectedId={categoryId}
        onSelect={(id) => {
          setCategoryId(id);
          setPicker(false);
        }}
        onClose={() => setPicker(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { height: 64, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 8 },
  back: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  backText: { fontSize: 30, color: colors.text, fontFamily: fontFamily.regular },
  title: { fontFamily: fontFamily.semibold, fontSize: fontSize.title, color: colors.text },
  body: { paddingHorizontal: layout.screenPadding, paddingTop: 4, paddingBottom: 24, gap: 14 },
  card: { backgroundColor: colors.surface, borderRadius: radii.card, padding: 16, gap: 14 },
  recipient: { flexDirection: "row", alignItems: "center", gap: 12 },
  badge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.bankTpbBg,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { fontFamily: fontFamily.bold, fontSize: fontSize.caption, color: colors.bankTpbFg },
  recipientText: { flex: 1, gap: 2 },
  recipientName: { fontFamily: fontFamily.semibold, fontSize: fontSize.row, color: colors.text },
  muted: { fontFamily: fontFamily.regular, fontSize: fontSize.secondary, color: colors.textMuted },
  amountBlock: { borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: 14, gap: 4 },
  amountInput: { fontFamily: fontFamily.bold, fontSize: fontSize.hero, color: colors.text, padding: 0 },
  hint: { fontFamily: fontFamily.medium, fontSize: fontSize.caption, color: colors.primary },
  noteRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 },
  noteInput: {
    flex: 1,
    textAlign: "right",
    padding: 0,
    fontFamily: fontFamily.medium,
    fontSize: fontSize.secondary,
    color: colors.text,
  },
  section: { fontFamily: fontFamily.semibold, fontSize: fontSize.secondary, color: colors.textMuted },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: radii.chip,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    justifyContent: "center",
  },
  chipOn: { borderWidth: 1.5, borderColor: colors.primary, backgroundColor: colors.primarySoft },
  chipText: { fontFamily: fontFamily.regular, fontSize: fontSize.secondary, color: colors.text },
  chipTextOn: { fontFamily: fontFamily.semibold, color: colors.primaryDark },
  appList: { backgroundColor: colors.surface, borderRadius: radii.card, overflow: "hidden" },
  appRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
  appRowOn: { backgroundColor: colors.primarySoft },
  appRowBorder: { borderTopWidth: 1, borderTopColor: colors.divider },
  appBadge: {
    width: 36,
    height: 36,
    borderRadius: radii.sm,
    backgroundColor: colors.divider,
    alignItems: "center",
    justifyContent: "center",
  },
  appBadgeText: { fontFamily: fontFamily.bold, fontSize: fontSize.tab, color: colors.textMuted },
  appName: { flex: 1, fontFamily: fontFamily.regular, fontSize: fontSize.body, color: colors.text },
  appNameOn: { fontFamily: fontFamily.semibold },
  appMode: { fontFamily: fontFamily.regular, fontSize: fontSize.caption, color: colors.textMuted },
  hiddenQr: { position: "absolute", left: -1000, top: -1000, opacity: 0 },
  check: { fontSize: 18, color: colors.primary },
  error: { fontFamily: fontFamily.regular, fontSize: fontSize.secondary, color: colors.expense },
  footer: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: layout.screenPadding,
    paddingTop: 12,
    paddingBottom: 28,
    gap: 8,
  },
  submit: {
    height: 54,
    borderRadius: radii.button,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  submitOff: { opacity: 0.4 },
  submitText: { fontFamily: fontFamily.semibold, fontSize: 16, color: colors.onPrimary },
  footNote: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.caption,
    color: colors.textMuted,
    textAlign: "center",
  },
});
