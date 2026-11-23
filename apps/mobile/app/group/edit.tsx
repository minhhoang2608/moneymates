import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState, type ComponentRef } from "react";
import { Keyboard, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { Avatar } from "@/components/group/Avatar";
import { GroupGlyph } from "@/components/group/GroupIconTile";
import { DateTimeField } from "@/components/transaction/DateTimeField";
import { SheetPicker } from "@/components/transaction/SheetPicker";
import { useRepositories } from "@/db/RepositoriesProvider";
import type { BankAccountRow } from "@/db/repositories";
import { vi } from "@/i18n/vi";
import { formatAccountNo } from "@/lib/account/display";
import { displayDate, fromDateString, groupErrorMessage, toDateString } from "@/lib/group/format";
import { groupIcons, type GroupIconKey } from "@/lib/group/icons";
import { GroupError } from "@/lib/group/types";
import { colors, fontFamily, fontSize, layout, radii } from "@/theme";

const t = vi.groups;

type Item = {
  key: string;
  /** Existing member id (edit mode); undefined for members added in this session. */
  id?: string;
  name: string;
  originalName?: string;
  isMe: boolean;
  hasTransactions: boolean;
};

let seq = 0;
const nextKey = () => `m${seq++}`;

function accountLabel(a: BankAccountRow | undefined): string {
  return a ? `${a.bank_name} •••• ${formatAccountNo(a.account_no).replace(/\s/g, "").slice(-4)}` : t.noAccount;
}

export default function GroupEditScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { groups, bankAccounts, profile } = useRepositories();
  const [name, setName] = useState("");
  const [icon, setIcon] = useState<GroupIconKey>("mountain");
  const [start, setStart] = useState<string | null>(null);
  const [end, setEnd] = useState<string | null>(null);
  const [picking, setPicking] = useState<"start" | "end" | null>(null);
  const [accounts, setAccounts] = useState<BankAccountRow[]>([]);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [accountSheet, setAccountSheet] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [removed, setRemoved] = useState<string[]>([]);
  const [newName, setNewName] = useState("");
  const [renaming, setRenaming] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);

  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", () => setKeyboardOpen(true));
    const hide = Keyboard.addListener("keyboardDidHide", () => {
      setKeyboardOpen(false);
      scrollToAddRow();
    });
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  function scrollToAddRow() {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
  }

  useEffect(() => {
    let alive = true;
    (async () => {
      const accs = await bankAccounts.listAccounts();
      if (!alive) return;
      setAccounts(accs);
      if (id) {
        const g = await groups.getGroup(id);
        if (!alive) return;
        setName(g.name);
        setIcon(groupIcons.some((i) => i.key === g.icon) ? (g.icon as GroupIconKey) : "mountain");
        setStart(g.start_date);
        setEnd(g.end_date);
        setAccountId(g.receiving_account_id);
        setItems(
          g.members.map((m) => ({
            key: m.id,
            id: m.id,
            name: m.displayName,
            originalName: m.displayName,
            isMe: m.isMe,
            hasTransactions: m.hasTransactions,
          })),
        );
      } else {
        const me = (await profile.getProfile()).display_name;
        if (!alive) return;
        setAccountId(accs.find((a) => a.is_default)?.id ?? null);
        setItems([{ key: nextKey(), name: me, isMe: true, hasTransactions: false }]);
      }
    })();
    return () => {
      alive = false;
    };
  }, [id, groups, bankAccounts, profile]);

  function addMember(text?: string) {
    const n = (text ?? newName).trim();
    if (!n) return;
    setItems((cur) => [...cur, { key: nextKey(), name: n, isMe: false, hasTransactions: false }]);
    setNewName("");
    scrollToAddRow();
  }

  function removeMember(item: Item) {
    setItems((cur) => cur.filter((m) => m.key !== item.key));
    if (item.id) setRemoved((cur) => [...cur, item.id as string]);
  }

  function renameMember(item: Item, value: string) {
    setItems((cur) => cur.map((m) => (m.key === item.key ? { ...m, name: value } : m)));
  }

  async function save() {
    if (!name.trim()) return setError(groupErrorMessage("name_required"));
    const others = items.filter((m) => !m.isMe);
    if (others.some((m) => !m.name.trim())) return setError(groupErrorMessage("member_name_required"));
    if (start && end && end < start) return setError(groupErrorMessage("invalid_dates"));
    setError(null);
    try {
      if (id) {
        await groups.updateGroup(id, {
          name,
          icon,
          start_date: start,
          end_date: end,
          receiving_account_id: accountId,
        });
        for (const rid of removed) await groups.removeMember(rid);
        for (const m of others) {
          if (m.id && m.name !== m.originalName) await groups.renameMember(m.id, m.name);
          if (!m.id) await groups.addMember(id, m.name);
        }
      } else {
        await groups.createGroup({
          name,
          icon,
          start_date: start,
          end_date: end,
          receiving_account_id: accountId,
          members: others.map((m) => m.name),
        });
      }
      router.back();
    } catch (e) {
      setError(e instanceof GroupError ? groupErrorMessage(e.code) : t.errors.unknown);
    }
  }

  const account = accounts.find((a) => a.id === accountId);

  return (
    <View style={styles.root} testID="screen-group-edit">
      <View style={styles.header}>
        <Pressable testID="group-close" accessibilityLabel={t.close} style={styles.close} onPress={() => router.back()}>
          <Text style={styles.closeGlyph}>✕</Text>
        </Pressable>
        <Text style={styles.title}>{id ? t.edit : t.create}</Text>
      </View>

      <ScrollView ref={scrollRef} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <View style={styles.field}>
            <Text style={styles.label}>{t.name}</Text>
            <TextInput
              testID="group-name"
              style={[styles.input, styles.inputText]}
              value={name}
              onChangeText={(v) => {
                setName(v);
                setError(null);
              }}
            />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>{t.icon}</Text>
            <View style={styles.icons}>
              {groupIcons.map((i) => (
                <Pressable
                  key={i.key}
                  testID={`group-icon-${i.key}`}
                  accessibilityLabel={i.label}
                  accessibilityState={{ selected: icon === i.key }}
                  style={[
                    styles.iconBtn,
                    icon === i.key
                      ? { backgroundColor: colors.primarySoft, borderColor: colors.primary, borderWidth: 2 }
                      : null,
                  ]}
                  onPress={() => setIcon(i.key)}
                >
                  <GroupGlyph path={i.path} color={i.fg} size={22} />
                </Pressable>
              ))}
            </View>
          </View>
          <View style={styles.dates}>
            {(["start", "end"] as const).map((which) => {
              const value = which === "start" ? start : end;
              const set = which === "start" ? setStart : setEnd;
              return (
                <View key={which} style={[styles.field, styles.half]}>
                  <Text style={styles.label}>{which === "start" ? t.start : t.end}</Text>
                  <View style={styles.dateRow}>
                    <Pressable
                      testID={`group-${which}-date`}
                      style={[styles.input, styles.dateInput]}
                      onPress={() => setPicking(which)}
                    >
                      <Text style={value ? styles.inputText : styles.placeholder}>
                        {value ? displayDate(value) : "dd/mm/yyyy"}
                      </Text>
                    </Pressable>
                    {value && (
                      <Pressable
                        testID={`group-${which}-date-clear`}
                        accessibilityLabel={t.clearDate}
                        style={styles.clear}
                        onPress={() => set(null)}
                      >
                        <Text style={styles.inputText}>✕</Text>
                      </Pressable>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
          <View style={styles.accountRow}>
            <View style={styles.accountInfo}>
              <Text style={styles.label}>{t.account}</Text>
              <Text testID="group-account" style={styles.accountText}>
                {accountLabel(account)}
              </Text>
            </View>
            <Pressable testID="group-account-change" style={styles.link} onPress={() => setAccountSheet(true)}>
              <Text style={styles.linkText}>{t.change}</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.card}>
          <Text testID="member-count" style={styles.section}>
            {t.members} ({items.length})
          </Text>
          {items.map((m, i) => (
            <View key={m.key} style={styles.memberRow}>
              <Avatar name={m.isMe ? m.name || t.me : m.name} index={i} size={32} />
              {m.isMe ? (
                <>
                  <Text testID="member-me" style={styles.memberName}>
                    {t.me} <Text style={styles.memberMuted}>({m.name})</Text>
                  </Text>
                  <Text style={styles.collector}>{t.collector}</Text>
                </>
              ) : renaming === m.key ? (
                <>
                  <TextInput
                    testID={`member-rename-input-${i}`}
                    style={[styles.input, styles.inputText, styles.renameInput]}
                    value={m.name}
                    onChangeText={(v) => renameMember(m, v)}
                    autoFocus
                  />
                  <Pressable
                    testID={`member-rename-save-${i}`}
                    style={styles.smallBtn}
                    onPress={() => setRenaming(null)}
                  >
                    <Text style={styles.smallBtnText}>{t.renameSave}</Text>
                  </Pressable>
                </>
              ) : (
                <>
                  <Text testID={`member-name-${i}`} style={styles.memberName}>
                    {m.name}
                  </Text>
                  <Pressable testID={`member-rename-${i}`} style={styles.smallBtn} onPress={() => setRenaming(m.key)}>
                    <Text style={styles.smallBtnText}>{t.rename}</Text>
                  </Pressable>
                  {!m.hasTransactions && (
                    <Pressable testID={`member-remove-${i}`} style={styles.smallBtn} onPress={() => removeMember(m)}>
                      <Text style={styles.smallBtnText}>{t.remove}</Text>
                    </Pressable>
                  )}
                </>
              )}
            </View>
          ))}
          <View style={styles.addRow}>
            <TextInput
              testID="member-add-input"
              style={[styles.input, styles.inputText, styles.addInput]}
              placeholder={t.memberPlaceholder}
              placeholderTextColor={colors.textMuted}
              value={newName}
              onChangeText={setNewName}
              onSubmitEditing={(e) => addMember(e?.nativeEvent?.text)}
              onFocus={scrollToAddRow}
              returnKeyType="done"
              submitBehavior="submit"
            />
            <Pressable testID="member-add" style={styles.addBtn} onPress={() => addMember()}>
              <Text style={styles.addBtnText}>{t.add}</Text>
            </Pressable>
          </View>
          <Text style={styles.hint}>{t.hint}</Text>
        </View>
        {error && (
          <Text testID="group-error" style={styles.error}>
            {error}
          </Text>
        )}
      </ScrollView>

      {!keyboardOpen && (
        <View style={styles.footer}>
          <Pressable testID="group-save" style={styles.primaryBtn} onPress={save}>
            <Text style={styles.primaryText}>{t.save}</Text>
          </Pressable>
        </View>
      )}

      {picking && (
        <DateTimeField
          dateOnly
          value={fromDateString((picking === "start" ? start : end) ?? toDateString(new Date()))}
          onChange={(d) => (picking === "start" ? setStart : setEnd)(toDateString(d))}
          onClose={() => setPicking(null)}
        />
      )}
      <SheetPicker
        visible={accountSheet}
        title={t.account}
        selectedKey={accountId}
        options={accounts.map((a) => ({
          key: a.id,
          label: accountLabel(a),
          testID: `group-account-option-${a.id}`,
        }))}
        onSelect={(key) => {
          setAccountId(key);
          setAccountSheet(false);
        }}
        onClose={() => setAccountSheet(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { height: 64, marginTop: 40, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 8 },
  close: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  closeGlyph: { fontSize: 20, color: colors.text },
  title: { fontFamily: fontFamily.semibold, fontSize: fontSize.title, color: colors.text, flex: 1 },
  body: { paddingHorizontal: layout.screenPadding, gap: 14, paddingBottom: 140 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  field: { gap: 6 },
  half: { flex: 1 },
  label: { fontFamily: fontFamily.regular, fontSize: fontSize.secondary, color: colors.textMuted },
  input: {
    height: 44,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    justifyContent: "center",
  },
  inputText: { fontFamily: fontFamily.regular, fontSize: fontSize.body, color: colors.text },
  placeholder: { fontFamily: fontFamily.regular, fontSize: fontSize.body, color: colors.textMuted },
  icons: { flexDirection: "row", gap: 8 },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  dates: { flexDirection: "row", gap: 10 },
  dateRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  dateInput: { flex: 1 },
  clear: { width: 32, height: 44, alignItems: "center", justifyContent: "center" },
  accountRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 44,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    paddingTop: 10,
  },
  accountInfo: { gap: 2, flex: 1 },
  accountText: { fontFamily: fontFamily.semibold, fontSize: fontSize.body, color: colors.text },
  link: { minHeight: 44, justifyContent: "center", paddingHorizontal: 8 },
  linkText: { fontFamily: fontFamily.semibold, fontSize: fontSize.body, color: colors.primary },
  section: { fontFamily: fontFamily.semibold, fontSize: fontSize.row, color: colors.text },
  memberRow: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  memberName: { flex: 1, fontFamily: fontFamily.semibold, fontSize: fontSize.body, color: colors.text },
  memberMuted: { fontFamily: fontFamily.regular, color: colors.textMuted },
  collector: { fontFamily: fontFamily.regular, fontSize: fontSize.caption, color: colors.textMuted },
  renameInput: { flex: 1 },
  smallBtn: {
    height: 32,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    justifyContent: "center",
  },
  smallBtnText: { fontFamily: fontFamily.regular, fontSize: fontSize.caption, color: colors.text },
  addRow: { flexDirection: "row", gap: 8, borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: 10 },
  addInput: { flex: 1 },
  addBtn: {
    height: 44,
    paddingHorizontal: 14,
    borderRadius: radii.sm,
    backgroundColor: colors.primarySoft,
    justifyContent: "center",
  },
  addBtnText: { fontFamily: fontFamily.semibold, fontSize: fontSize.body, color: colors.primaryDark },
  hint: { fontFamily: fontFamily.regular, fontSize: fontSize.caption, color: colors.textMuted },
  error: { fontFamily: fontFamily.regular, fontSize: fontSize.body, color: colors.expense },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: layout.screenPadding,
    paddingTop: 12,
    paddingBottom: 28,
  },
  primaryBtn: {
    height: 54,
    borderRadius: radii.button,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: { fontFamily: fontFamily.semibold, fontSize: 16, color: colors.onPrimary },
});
