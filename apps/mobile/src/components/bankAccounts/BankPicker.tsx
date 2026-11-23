import { useState } from "react";
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { vi } from "@/i18n/vi";
import { toAsciiText } from "@/lib/vietqr/message";
import { BANKS, type Bank } from "@/lib/vietqr/banks";
import { colors, fontFamily, fontSize, radii } from "@/theme";

export function BankPicker({
  visible,
  onSelect,
  onClose,
}: {
  visible: boolean;
  onSelect: (bank: Bank) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const q = toAsciiText(query).toLowerCase();
  const items = BANKS.filter(
    (b) => !q || toAsciiText(b.shortName).toLowerCase().includes(q) || b.code.toLowerCase().includes(q),
  );
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        <Text style={styles.title}>{vi.bankAccounts.bankPlaceholder}</Text>
        <TextInput
          testID="bank-search"
          style={styles.input}
          placeholder={vi.bankAccounts.searchBank}
          placeholderTextColor={colors.textMuted}
          value={query}
          onChangeText={setQuery}
        />
        <FlatList
          data={items}
          keyExtractor={(b) => b.bin}
          renderItem={({ item }) => (
            <Pressable
              testID={`bank-option-${item.code}`}
              style={styles.row}
              onPress={() => {
                setQuery("");
                onSelect(item);
              }}
            >
              <Text style={styles.rowText}>{item.shortName}</Text>
            </Pressable>
          )}
        />
        <Pressable testID="bank-picker-close" style={styles.close} onPress={onClose}>
          <Text style={styles.rowText}>{vi.bankAccounts.cancel}</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background, paddingTop: 56, paddingHorizontal: 20, gap: 12 },
  title: { fontFamily: fontFamily.semibold, fontSize: fontSize.title, color: colors.text },
  input: {
    height: 44,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    fontFamily: fontFamily.regular,
    fontSize: fontSize.body,
    color: colors.text,
  },
  row: { height: 48, justifyContent: "center", borderBottomWidth: 1, borderBottomColor: colors.divider },
  rowText: { fontFamily: fontFamily.regular, fontSize: fontSize.body, color: colors.text },
  close: { height: 54, alignItems: "center", justifyContent: "center" },
});
