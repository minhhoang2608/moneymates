import { useSafeAreaInsets } from "react-native-safe-area-context";
import { haptics } from "@/lib/haptics";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Platform, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { PressableScale } from "@/components/PressableScale";

import { AppPickerSheet } from "@/components/payConfirm/AppPickerSheet";
import { HandOffQr, type QrRef } from "@/components/payConfirm/HandOffQr";
import { startHandOff } from "@/lib/payConfirm/startHandOff";
import { PayAppRow } from "@/components/payConfirm/PayAppRow";
import { useEnabledPayApps } from "@/hooks/useEnabledPayApps";
import { preselectApp, type LastUsedByBank } from "@/lib/payConfirm/preselect";
import { TargetLine } from "@/components/target/TargetLine";
import { useTargetDefault } from "@/components/target/useTargetDefault";
import { CategoryPicker } from "@/components/transaction/CategoryPicker";
import { useRepositories } from "@/db/RepositoriesProvider";
import type { CategoryRow } from "@/db/repositories";
import { useAiAvailable } from "@/api/features";
import { useCategorySuggestion } from "@/api/parseText";
import { vi } from "@/i18n/vi";
import { aiText, pickInitialCategory } from "@/lib/payConfirm/category";
import { useBankApps } from "@/api/bankApps";
import { buildPayApps, normalizeAppId } from "@/lib/payConfirm/apps";
import { buildQrExpense, buildQrGroupExpense, canSubmit } from "@/lib/payConfirm/form";
import { buildClipboardText } from "@/lib/payConfirm/deeplink";
import { makeHandOff } from "@/lib/payConfirm/handOffDeps";
import { parsePayConfirmParams } from "@/lib/payConfirm/params";
import { shareConfirmedQr } from "@/lib/payConfirm/shareQr";
import { shareQr } from "@/lib/share/qrImage";
import * as Clipboard from "expo-clipboard";
import { formatVnd, parseAmount } from "@/lib/money";
import { DEFAULT_NON_AUTOFILL_MODE, PREF_KEYS, type NonAutofillMode } from "@/lib/preferences/defaults";
import { useToast } from "@/stores/toast";
import { useHandOffDiag } from "@/stores/handOffDiag";
import { usePendingHandOff } from "@/stores/pendingHandOff";
import { colors, fontFamily, fontSize, layout, radii } from "@/theme";

const RECENT_KEY = PREF_KEYS.recentPayApps;

export default function PayConfirmScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<Record<string, string>>();
  const model = useMemo(() => parsePayConfirmParams(params), [params]);
  const {
    transactions,
    categories,
    appSettings,
    groups: groupRepo,
    groupExpenses,
    handOffMemory,
    handOffs,
    preferences,
  } = useRepositories();
  const targetState = useTargetDefault();
  const { target } = targetState;

  const [amountText, setAmountText] = useState(model.amount !== undefined ? String(model.amount) : "");
  const [note, setNote] = useState(model.message ?? "");
  const [cats, setCats] = useState<CategoryRow[]>([]);
  const [initialId, setInitialId] = useState<string | null>(null);
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [picker, setPicker] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const [lastUsed, setLastUsed] = useState<LastUsedByBank>({});
  const { enabled: enabledApps, reload: reloadEnabled } = useEnabledPayApps();
  const [appId, setAppId] = useState<string | null>(null);
  const [appSheet, setAppSheet] = useState(false);
  const [failed, setFailed] = useState(false);
  const [keywordHit, setKeywordHit] = useState<boolean | null>(null);
  const [nonAutofillMode, setNonAutofillMode] = useState<NonAutofillMode>(DEFAULT_NON_AUTOFILL_MODE);
  const busy = useRef(false);
  const qrRef = useRef<QrRef | null>(null);

  useEffect(() => {
    let alive = true;
    categories.listByKind("expense").then((rows) => {
      if (!alive) return;
      setCats(rows);
      const initial = pickInitialCategory(rows, model.kind === "vietqr" ? model.name : null, model.message);
      setInitialId((cur) => cur ?? initial.id);
      setKeywordHit(initial.source === "keyword");
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories]);

  const ai = useAiAvailable("parse_text");
  const aiName = useCategorySuggestion({
    text: aiText(model.kind === "vietqr" ? model.name : null, model.message),
    categories: useMemo(() => cats.map((c) => c.name), [cats]),
    enabled: keywordHit === false && ai.available,
  });
  // A tap always wins; the AI answer only replaces the initial choice.
  const aiId = cats.find((c) => c.name === aiName)?.id ?? null;
  const categoryId = pickedId ?? aiId ?? initialId;

  useEffect(() => {
    let alive = true;
    appSettings.get<string[]>(RECENT_KEY).then((ids) => alive && setRecent(Array.isArray(ids) ? ids : []));
    return () => {
      alive = false;
    };
  }, [appSettings]);

  useEffect(() => {
    let alive = true;
    handOffMemory
      .getLastUsedByBank()
      .then((map) => alive && setLastUsed(map))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [handOffMemory]);

  // Changes made on the "App thanh toán" page apply when this screen is shown again.
  useFocusEffect(
    useCallback(() => {
      reloadEnabled().catch(() => {});
      preferences
        .getNonAutofillMode()
        .then(setNonAutofillMode)
        .catch(() => {});
    }, [reloadEnabled, preferences]),
  );

  const recentIds = useMemo(() => recent.map(normalizeAppId), [recent]);
  const bankApps = useBankApps();
  const payApps = useMemo(() => buildPayApps(bankApps, Platform.OS === "ios" ? "ios" : "android"), [bankApps]);
  const selectedId = appId ?? preselectApp(model.bankBin, enabledApps, lastUsed, payApps);
  const selected = payApps.find((a) => a.id === selectedId) ?? payApps[0];

  const parsed = parseAmount(amountText);
  const enabled = canSubmit(amountText) && categoryId !== null;
  const chips = useMemo(() => {
    const first = cats.slice(0, 3);
    const chosen = cats.find((c) => c.id === categoryId);
    return chosen && !first.includes(chosen) ? [...first.slice(0, 2), chosen] : first;
  }, [cats, categoryId]);

  const confirmedAmount = parsed.ok ? parsed.vnd : undefined;

  const getQrBase64 = () =>
    new Promise<string | null>((resolve) => {
      if (!qrRef.current) return resolve(null);
      qrRef.current.toDataURL((data) => resolve(data || null));
    });

  const share = async () => {
    if (model.kind !== "vietqr") return;
    const text = buildClipboardText({
      account: model.account,
      amount: parsed.ok ? parsed.vnd : undefined,
      message: note,
    });
    try {
      await shareConfirmedQr(
        { getQrBase64, setClipboard: (t) => Clipboard.setStringAsync(t).then(() => {}), share: shareQr },
        text,
      );
    } catch (e) {
      console.warn("share failed", e);
    }
  };

  const submit = async () => {
    if (busy.current || !parsed.ok || !categoryId) return;
    haptics.light();
    busy.current = true;
    setFailed(false);
    let txId: string;
    try {
      const input = { amount: parsed.vnd, categoryId, note };
      if (target.kind === "group") {
        const g = await groupRepo.getGroup(target.groupId);
        const tx = await groupExpenses.createGroupExpense(
          buildQrGroupExpense(model, input, g.id, g.members, new Date()),
        );
        txId = tx.id;
      } else {
        txId = (await transactions.create(buildQrExpense(model, input, new Date()))).id;
      }
    } catch {
      busy.current = false;
      setFailed(true);
      return;
    }
    try {
      if (model.kind === "vietqr") await handOffMemory.setLastUsedForBank(model.bankBin, selected.id).catch(() => {});
      await appSettings.set(RECENT_KEY, [selected.id, ...recent.filter((id) => id !== selected.id)].slice(0, 10));
      usePendingHandOff.getState().set({ txId, amount: parsed.vnd, label: note });
    } catch {
      busy.current = false;
      router.back();
      return;
    }
    await runHandOff(parsed.vnd, note);
  };

  const runHandOff = async (amount: number, text: string) => {
    try {
      const result = await startHandOff(
        {
          makeHandOff,
          handOffs,
          handOffMemory,
          record: {
            platform: Platform.OS === "android" ? "android" : "ios",
            preferences,
            showToast: useToast.getState().show,
            addOnlyMessage: vi.qrImage.addOnlyPermission,
          },
        },
        {
          app: selected,
          model,
          amount,
          note: text,
          nonAutofillMode,
          txId: usePendingHandOff.getState().pending?.txId,
          getQrBase64,
          onRow: (id) => usePendingHandOff.getState().setHandOffId(id),
        },
      );
      useHandOffDiag.getState().set(result.shareDiag ?? null);
      if (!result.opened) useToast.getState().show(vi.handOff.openFailed(selected.name));
    } catch {
      useToast.getState().show(vi.handOff.openFailed(selected.name));
    } finally {
      router.back();
    }
  };

  return (
    <View style={styles.root} testID="screen-pay-confirm">
      <View testID="screen-header" style={[styles.header, { paddingTop: insets.top, height: 64 + insets.top }]}>
        <PressableScale
          testID="pay-back"
          accessibilityRole="button"
          accessibilityLabel={vi.payConfirm.back}
          onPress={() => router.back()}
          style={styles.back}
        >
          <Text style={styles.backText}>‹</Text>
        </PressableScale>
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
              <PressableScale
                key={c.id}
                testID={`pay-category-${c.id}`}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                onPress={() => setPickedId(c.id)}
                style={[styles.chip, on && styles.chipOn]}
              >
                <Text style={[styles.chipText, on && styles.chipTextOn]}>{c.name}</Text>
              </PressableScale>
            );
          })}
          <PressableScale
            testID="pay-category-more"
            accessibilityRole="button"
            onPress={() => setPicker(true)}
            style={styles.chip}
          >
            <Text style={styles.chipText}>{vi.payConfirm.categoryMore}</Text>
          </PressableScale>
        </View>

        <TargetLine
          value={target}
          onChange={targetState.setTarget}
          groups={targetState.groups}
          lastUsedByGroup={targetState.lastUsedByGroup}
          memberCounts={targetState.memberCounts}
          now={targetState.now}
        />
        {target.kind === "group" ? (
          <Text testID="pay-group-hint" style={styles.hint}>
            {vi.payConfirm.groupHint(targetState.memberCounts.get(target.groupId) ?? 0)}
          </Text>
        ) : null}

        <Text style={styles.section}>{vi.payConfirm.payWith}</Text>
        <PayAppRow app={selected} onChange={() => setAppSheet(true)} />
        {failed ? (
          <Text testID="pay-error" style={styles.error}>
            {vi.payConfirm.saveFailed}
          </Text>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        <PressableScale
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
        </PressableScale>
        {!selected.supportsAutofill ? (
          <Text testID="pay-howto" style={styles.howTo}>
            {nonAutofillMode === "no_image" ? (
              vi.payConfirm.howToPaste
            ) : (
              <>
                {vi.payConfirm.howTo.prefix(selected.name)}
                <Text style={styles.howToBold}>{vi.payConfirm.howTo.steps}</Text>
                {vi.payConfirm.howTo.suffix}
              </>
            )}
          </Text>
        ) : null}
        {Platform.OS === "android" && model.kind === "vietqr" ? (
          <PressableScale testID="pay-share-qr" accessibilityRole="button" onPress={share} style={styles.shareBtn}>
            <Text style={styles.shareText}>{vi.payConfirm.shareQr}</Text>
          </PressableScale>
        ) : null}
        <Text style={styles.footNote}>{vi.payConfirm.saveNote}</Text>
      </View>

      <HandOffQr model={model} amount={confirmedAmount} note={note} getRef={(r) => (qrRef.current = r)} />

      {appSheet ? (
        <AppPickerSheet
          enabled={enabledApps}
          qrBin={model.bankBin}
          recentIds={recentIds}
          lastUsedId={model.bankBin ? lastUsed[model.bankBin] : undefined}
          selectedId={selected.id}
          catalogue={payApps}
          onSelect={(id) => {
            setAppId(id);
            setAppSheet(false);
          }}
          onManage={() => {
            setAppSheet(false);
            router.push("/payment-apps");
          }}
          onClose={() => setAppSheet(false)}
        />
      ) : null}

      <CategoryPicker
        visible={picker}
        categories={cats}
        selectedId={categoryId}
        onSelect={(id) => {
          setPickedId(id);
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
  shareBtn: { alignItems: "center", paddingVertical: 10 },
  shareText: { fontFamily: fontFamily.semibold, fontSize: fontSize.body, color: colors.primaryDark },
  submitText: { fontFamily: fontFamily.semibold, fontSize: 16, color: colors.onPrimary },
  howTo: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.caption,
    lineHeight: 17,
    color: colors.textMuted,
    textAlign: "center",
  },
  howToBold: { fontFamily: fontFamily.semibold, color: colors.text },
  footNote: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.caption,
    color: colors.textMuted,
    textAlign: "center",
  },
});
