import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { useAiAvailable } from "@/api/features";
import { ApiError } from "@/api/errors";
import { parseBill, type ParseBillResponse } from "@/api/parseBill";
import { useRepositories } from "@/db/RepositoriesProvider";
import type { CategoryRow } from "@/db/repositories";
import { vi } from "@/i18n/vi";
import { BILL_PRIVACY_KEY } from "@/lib/bill/constants";
import { billErrorMessage, toBillCard, toFormParams } from "@/lib/bill/billResult";
import { getBillImageSource } from "@/lib/bill/imageSource";
import { colors, overlays, fontFamily, fontSize, radii } from "@/theme";

type Phase = "init" | "consent" | "idle" | "uploading" | "result" | "error";

export default function BillScreen() {
  const router = useRouter();
  const { categories: catRepo, appSettings } = useRepositories();
  const ai = useAiAvailable("parse_bill");
  const [phase, setPhase] = useState<Phase>("init");
  const [result, setResult] = useState<ParseBillResponse | null>(null);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cats = useRef<CategoryRow[]>([]);
  const started = useRef(false);
  const alive = useRef(true);
  const run = useRef(0);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const upload = useCallback(async (pick: boolean) => {
    const id = ++run.current;
    const live = () => alive.current && id === run.current;
    try {
      const src = getBillImageSource();
      const uri = await (pick ? src.pick() : src.capture());
      if (!live()) return;
      if (!uri) return setPhase("idle");
      setImageUri(uri);
      setResult(null);
      setPhase("uploading");
      const res = await parseBill(
        uri,
        cats.current.map((c) => c.name),
      );
      if (!live()) return;
      setResult(res);
      setPhase("result");
    } catch (e) {
      if (!live()) return;
      setError(billErrorMessage(e instanceof ApiError ? e.code : "network"));
      setPhase("error");
    }
  }, []);

  useEffect(() => {
    if (started.current || ai.reason === "loading") return;
    started.current = true;
    if (!ai.available) return;
    (async () => {
      const [rows, accepted] = await Promise.all([
        catRepo.listByKind("expense"),
        appSettings.get<boolean>(BILL_PRIVACY_KEY),
      ]);
      if (!alive.current) return;
      cats.current = rows;
      if (accepted) void upload(false);
      else setPhase("consent");
    })();
  }, [ai.available, ai.reason, appSettings, catRepo, upload]);

  const accept = async () => {
    await appSettings.set(BILL_PRIVACY_KEY, true);
    void upload(false);
  };

  const categoryId = (r: ParseBillResponse | null) =>
    cats.current.find((c) => c.name === (r?.category ?? "Khác"))?.id ??
    cats.current.find((c) => c.name === "Khác")?.id ??
    null;

  const fill = () =>
    router.replace({ pathname: "/transaction/new", params: toFormParams(result, imageUri, categoryId(result)) });
  const manual = () =>
    router.replace({
      pathname: "/transaction/new",
      params: toFormParams(null, null, categoryId(null)),
    });

  const unavailable = ai.reason !== null && ai.reason !== "loading";
  const view: Phase = unavailable ? "error" : phase;
  const message = unavailable ? vi.bill.unavailable : error;

  const card = result ? toBillCard(result) : null;
  const rows: [string, string, string][] = card
    ? [
        ["amount", vi.bill.total, card.amount],
        ["shop", vi.bill.shop, card.shop],
        ["date", vi.bill.date, card.date],
        ["category", vi.bill.category, card.category],
      ]
    : [];

  return (
    <View style={styles.root} testID="screen-bill">
      <View style={styles.header}>
        <Pressable
          testID="bill-close"
          accessibilityRole="button"
          accessibilityLabel={vi.bill.close}
          onPress={() => router.back()}
          style={styles.close}
        >
          <Text style={styles.closeText}>✕</Text>
        </Pressable>
        <Text style={styles.title}>{vi.bill.title}</Text>
        <View style={styles.close} />
      </View>

      <View style={styles.receipt} accessibilityElementsHidden>
        <View
          style={[styles.line, { width: "70%", alignSelf: "center", height: 10, backgroundColor: colors.receiptInk }]}
        />
        <View style={[styles.line, { width: "50%", alignSelf: "center" }]} />
        <View style={styles.rule} />
        {[90, 80, 86, 74].map((w) => (
          <View key={w} style={[styles.line, { width: `${w}%` }]} />
        ))}
        <View style={styles.rule} />
        <View style={styles.total} />
      </View>

      <View style={styles.sheet}>
        {view === "consent" ? (
          <View testID="bill-privacy" style={styles.gap}>
            <Text style={styles.sheetTitle}>{vi.bill.privacyTitle}</Text>
            <Text style={styles.privacy}>{vi.bill.privacy}</Text>
            <View style={styles.buttons}>
              <Pressable
                testID="bill-manual"
                accessibilityRole="button"
                onPress={manual}
                style={[styles.btn, styles.ghost]}
              >
                <Text style={styles.ghostText}>{vi.bill.manual}</Text>
              </Pressable>
              <Pressable
                testID="bill-accept"
                accessibilityRole="button"
                onPress={accept}
                style={[styles.btn, styles.primary]}
              >
                <Text style={styles.primaryText}>{vi.bill.accept}</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {view === "uploading" || view === "init" ? (
          <View testID="bill-loading" style={[styles.gap, styles.center]}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.privacy}>{vi.bill.reading}</Text>
          </View>
        ) : null}

        {view === "idle" ? (
          <View style={styles.gap}>
            <Text style={styles.privacy}>{vi.bill.idle}</Text>
            <View style={styles.buttons}>
              <Pressable
                testID="bill-pick"
                accessibilityRole="button"
                onPress={() => void upload(true)}
                style={[styles.btn, styles.ghost]}
              >
                <Text style={styles.ghostText}>{vi.bill.pick}</Text>
              </Pressable>
              <Pressable
                testID="bill-retake"
                accessibilityRole="button"
                onPress={() => void upload(false)}
                style={[styles.btn, styles.primary]}
              >
                <Text style={styles.primaryText}>{vi.bill.retake}</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {view === "error" ? (
          <View style={styles.gap}>
            <Text testID="bill-error" style={styles.error}>
              {message}
            </Text>
            <View style={styles.buttons}>
              <Pressable
                testID="bill-manual"
                accessibilityRole="button"
                onPress={manual}
                style={[styles.btn, styles.primary]}
              >
                <Text style={styles.primaryText}>{vi.bill.manual}</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {view === "result" && card ? (
          <View style={styles.gap} testID="bill-result">
            <Text style={styles.sheetTitle}>✓ {vi.bill.done}</Text>
            <View style={styles.card}>
              {rows.map(([key, label, value], i) => (
                <View key={key} style={[styles.row, i === rows.length - 1 && styles.lastRow]}>
                  <Text style={styles.rowLabel}>{label}</Text>
                  <Text testID={`bill-${key}`} style={key === "amount" ? styles.amount : styles.rowValue}>
                    {value}
                  </Text>
                </View>
              ))}
            </View>
            <Text style={styles.privacy}>{vi.bill.privacy}</Text>
            <View style={styles.buttons}>
              <Pressable
                testID="bill-retake"
                accessibilityRole="button"
                onPress={() => void upload(false)}
                style={[styles.btn, styles.ghost]}
              >
                <Text style={styles.ghostText}>{vi.bill.retake}</Text>
              </Pressable>
              <Pressable
                testID="bill-fill-form"
                accessibilityRole="button"
                onPress={fill}
                style={[styles.btn, styles.primary]}
              >
                <Text style={styles.primaryText}>{vi.bill.fillForm}</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.scannerBg },
  header: {
    marginTop: 40,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  close: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  closeText: {
    fontSize: 20,
    color: colors.onPrimary,
    backgroundColor: overlays.button,
    width: 44,
    height: 44,
    borderRadius: 22,
    textAlign: "center",
    lineHeight: 44,
    overflow: "hidden",
  },
  title: { fontFamily: fontFamily.semibold, fontSize: fontSize.title, color: colors.onPrimary },
  receipt: {
    position: "absolute",
    top: 96,
    alignSelf: "center",
    width: 200,
    height: 300,
    backgroundColor: colors.receipt,
    borderRadius: 4,
    transform: [{ rotate: "-3deg" }],
    paddingVertical: 18,
    paddingHorizontal: 16,
    gap: 8,
  },
  line: { height: 6, borderRadius: 2, backgroundColor: colors.neutral },
  rule: { height: 1, backgroundColor: colors.receiptLine, marginVertical: 6 },
  total: { height: 14, width: "60%", alignSelf: "flex-end", borderRadius: 2, backgroundColor: colors.primary },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.sheet,
    borderTopRightRadius: radii.sheet,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 32,
    minHeight: 160,
  },
  gap: { gap: 14 },
  center: { alignItems: "center" },
  sheetTitle: { fontFamily: fontFamily.semibold, fontSize: 16, color: colors.text },
  card: { backgroundColor: colors.background, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 4 },
  row: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  lastRow: { borderBottomWidth: 0 },
  rowLabel: { fontFamily: fontFamily.regular, fontSize: fontSize.body, color: colors.textMuted },
  rowValue: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.body,
    color: colors.text,
    flexShrink: 1,
    textAlign: "right",
  },
  amount: { fontFamily: fontFamily.bold, fontSize: 16, color: colors.text },
  privacy: { fontFamily: fontFamily.regular, fontSize: fontSize.caption, color: colors.textMuted },
  error: { fontFamily: fontFamily.regular, fontSize: fontSize.body, color: colors.expense },
  buttons: { flexDirection: "row", gap: 10 },
  btn: { flex: 1, height: 52, borderRadius: radii.button, alignItems: "center", justifyContent: "center" },
  ghost: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  ghostText: { fontFamily: fontFamily.semibold, fontSize: 15, color: colors.text },
  primary: { backgroundColor: colors.primary },
  primaryText: { fontFamily: fontFamily.semibold, fontSize: 15, color: colors.onPrimary },
});
