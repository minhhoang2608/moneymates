import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { useRepositories } from "@/db/RepositoriesProvider";
import type { TransactionRow } from "@/db/repositories";
import { vi } from "@/i18n/vi";
import { formatDetailDateTime, qrDetails } from "@/lib/transaction/detail";
import { signedAmountLabel } from "@/lib/transaction/form";
import { colors, fontFamily, fontSize, layout, radii } from "@/theme";

type Loaded = { txn: TransactionRow | null; categoryName: string } | null;

function Row({ label, value, last, testID }: { label: string; value: string; last?: boolean; testID: string }) {
  return (
    <View style={[styles.infoRow, !last && styles.infoDivider]}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} testID={testID}>
        {value}
      </Text>
    </View>
  );
}

export default function TransactionDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { transactions, categories } = useRepositories();
  const [data, setData] = useState<Loaded>(null);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      Promise.all([
        transactions.getById(String(id)),
        categories.listByKind("expense"),
        categories.listByKind("income"),
      ]).then(([txn, exp, inc]) => {
        if (!alive) return;
        const cat = [...exp, ...inc].find((c) => c.id === txn?.category_id);
        setData({ txn, categoryName: cat?.name ?? "" });
      });
      return () => {
        alive = false;
      };
    }, [transactions, categories, id]),
  );

  const confirmDelete = (txn: TransactionRow) => {
    Alert.alert(vi.detail.deleteTitle, vi.detail.deleteMessage, [
      { text: vi.detail.cancel, style: "cancel" },
      {
        text: vi.detail.confirmDelete,
        style: "destructive",
        onPress: async () => {
          await transactions.softDelete(txn.id);
          router.back();
        },
      },
    ]);
  };

  const txn = data?.txn ?? null;
  const qr = qrDetails(txn?.qr_data);
  const title = txn ? txn.note || data?.categoryName || "" : "";
  const sourceLabel = txn ? (vi.history.sources[txn.source] ?? txn.money_source) : "";

  return (
    <View style={styles.root} testID="screen-transaction-detail">
      <View style={styles.header}>
        <Pressable
          testID="detail-back"
          accessibilityRole="button"
          accessibilityLabel={vi.detail.back}
          onPress={() => router.back()}
          style={styles.back}
        >
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <Text style={styles.headerTitle}>{vi.detail.title}</Text>
        {txn ? (
          <Pressable
            testID="detail-edit"
            accessibilityRole="button"
            onPress={() => router.push({ pathname: "/transaction/new", params: { transactionId: txn.id } })}
            style={styles.edit}
          >
            <Text style={styles.editText}>{vi.detail.edit}</Text>
          </Pressable>
        ) : null}
      </View>

      {data && !txn ? (
        <Text style={styles.notFound} testID="detail-not-found">
          {vi.detail.notFound}
        </Text>
      ) : null}

      {txn ? (
        <>
          <ScrollView contentContainerStyle={styles.content}>
            <View style={styles.hero}>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{title.trim().slice(0, 1).toLocaleUpperCase("vi") || "?"}</Text>
              </View>
              <Text style={styles.heroTitle} testID="detail-title">
                {title}
              </Text>
              <Text
                style={[styles.amount, { color: txn.type === "expense" ? colors.expense : colors.primary }]}
                testID="detail-amount"
              >
                {signedAmountLabel(txn.type, txn.amount)}
              </Text>
            </View>

            <View style={styles.card}>
              <Row label={vi.detail.category} value={data?.categoryName ?? ""} testID="detail-category" />
              <Row label={vi.detail.time} value={formatDetailDateTime(txn.occurred_at)} testID="detail-time" />
              <Row label={vi.detail.moneySource} value={txn.money_source} testID="detail-money-source" />
              <Row
                label={vi.detail.entryMethod}
                value={qr ? `${sourceLabel} · ${qr.bank}` : sourceLabel}
                last={!qr && !txn.note}
                testID="detail-source"
              />
              {qr ? <Row label={vi.detail.payee} value={qr.payee} last={!txn.note} testID="detail-payee" /> : null}
              {txn.note ? <Row label={vi.detail.note} value={txn.note} last testID="detail-note" /> : null}
            </View>

            {txn.photo_uri ? (
              <Image testID="detail-photo" source={{ uri: txn.photo_uri }} style={styles.photo} resizeMode="cover" />
            ) : qr ? (
              <View style={[styles.card, styles.qrCard]} testID="detail-qr">
                <View style={styles.motif} />
                <View style={styles.qrText}>
                  <Text style={styles.qrTitle}>{vi.detail.qrScanned}</Text>
                  <Text style={styles.qrMessage}>{`${vi.detail.qrMessage}${qr.message}`}</Text>
                </View>
              </View>
            ) : null}
          </ScrollView>
          <View style={styles.footer}>
            <Pressable
              testID="detail-delete"
              accessibilityRole="button"
              onPress={() => confirmDelete(txn)}
              style={styles.delete}
            >
              <Text style={styles.deleteText}>{vi.detail.delete}</Text>
            </Pressable>
          </View>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingTop: 40, backgroundColor: colors.background },
  header: { height: 64, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 8 },
  back: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  backText: { fontFamily: fontFamily.semibold, fontSize: 28, color: colors.text },
  headerTitle: { flex: 1, fontFamily: fontFamily.semibold, fontSize: fontSize.title, color: colors.text },
  edit: { paddingHorizontal: 12, height: 44, justifyContent: "center" },
  editText: { fontFamily: fontFamily.semibold, fontSize: fontSize.row, color: colors.primary },
  content: { paddingHorizontal: layout.screenPadding, paddingBottom: 120, gap: 14 },
  hero: { alignItems: "center", gap: 6, paddingVertical: 8 },
  badge: {
    width: 56,
    height: 56,
    borderRadius: radii.card,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { fontFamily: fontFamily.bold, fontSize: 16, color: colors.primary },
  heroTitle: { fontFamily: fontFamily.semibold, fontSize: fontSize.row, color: colors.text },
  amount: { fontFamily: fontFamily.bold, fontSize: 30 },
  card: { backgroundColor: colors.surface, borderRadius: radii.card, paddingHorizontal: 16, paddingVertical: 4 },
  infoRow: { minHeight: 44, flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 },
  infoDivider: { borderBottomWidth: 1, borderBottomColor: colors.divider },
  infoLabel: { fontFamily: fontFamily.regular, fontSize: fontSize.body, color: colors.textMuted },
  infoValue: {
    flex: 1,
    textAlign: "right",
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.body,
    color: colors.text,
  },
  qrCard: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14 },
  motif: { width: 56, height: 56, borderRadius: radii.sm, backgroundColor: colors.divider },
  qrText: { flex: 1, gap: 2 },
  qrTitle: { fontFamily: fontFamily.semibold, fontSize: fontSize.body, color: colors.text },
  qrMessage: { fontFamily: fontFamily.regular, fontSize: fontSize.caption, color: colors.textMuted },
  photo: { width: "100%", height: 220, borderRadius: radii.card, backgroundColor: colors.divider },
  notFound: {
    padding: 24,
    textAlign: "center",
    fontFamily: fontFamily.regular,
    fontSize: fontSize.body,
    color: colors.textMuted,
  },
  footer: { position: "absolute", left: 20, right: 20, bottom: 32 },
  delete: {
    height: 52,
    borderRadius: radii.button,
    borderWidth: 1,
    borderColor: colors.expenseBorder,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  deleteText: { fontFamily: fontFamily.semibold, fontSize: fontSize.row, color: colors.expense },
});
