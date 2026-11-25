import { StyleSheet, Text, View } from "react-native";

import { CameraIcon, MicIcon } from "@/components/icons";
import { PressableScale } from "@/components/PressableScale";
import { vi } from "@/i18n/vi";
import { colors, fontFamily, fontSize } from "@/theme";

type Props = { onVoice: () => void; onBill: () => void };

/** Entry-mode switch on the new group expense form: "Nhập tay" is selected, Voice / Chụp bill leave the form. */
export function EntryModeSwitch({ onVoice, onBill }: Props) {
  return (
    <View style={styles.row} accessibilityLabel={vi.entryMode.label} testID="entry-mode-switch">
      <View
        testID="entry-mode-manual"
        accessibilityRole="button"
        accessibilityState={{ selected: true }}
        style={[styles.chip, styles.chipActive]}
      >
        <Text style={[styles.text, styles.textActive]}>{vi.entryMenu.manual}</Text>
      </View>
      <PressableScale
        testID="entry-mode-voice"
        accessibilityRole="button"
        accessibilityState={{ selected: false }}
        onPress={onVoice}
        style={styles.chip}
      >
        <MicIcon color={colors.text} size={16} />
        <Text style={styles.text}>{vi.entryMenu.voice}</Text>
      </PressableScale>
      <PressableScale
        testID="entry-mode-bill"
        accessibilityRole="button"
        accessibilityState={{ selected: false }}
        onPress={onBill}
        style={styles.chip}
      >
        <CameraIcon color={colors.text} size={16} />
        <Text style={styles.text}>{vi.entryMenu.bill}</Text>
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 8 },
  chip: {
    flex: 1,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  chipActive: { borderWidth: 1.5, borderColor: colors.primary, backgroundColor: colors.primarySoft },
  text: { fontFamily: fontFamily.regular, fontSize: fontSize.secondary, color: colors.text },
  textActive: { fontFamily: fontFamily.semibold, color: colors.primaryDark },
});
