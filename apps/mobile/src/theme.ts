export const colors = {
  primary: "#0E7C66",
  primaryDark: "#0A5E4D",
  primarySoft: "#E7F4F0",
  primarySoft2: "#D3EEE6",
  accent: "#3DD6B0",
  background: "#F6F7F9",
  surface: "#FFFFFF",
  scannerBg: "#1B1F24",
  text: "#111827",
  textMuted: "#5B6472",
  border: "#E6E8EC",
  divider: "#EEF0F3",
  segmentBg: "#E9ECF0",
  neutral: "#A5ABB5",
  expense: "#B42318",
  expenseBorder: "#F1C4C0",
  warningBg: "#FEF3E2",
  warningBorder: "#F5D9A8",
  warningText: "#7A4300",
  onPrimary: "#FFFFFF",
  onDarkMuted: "#D1D5DB",
  onDarkDivider: "#323845",
  receipt: "#FBFAF6",
  receiptInk: "#2B2F36",
  receiptLine: "#D5D9DF",
  shadow: "#0E7C66",
  bankTcbBg: "#FDE8E8",
  bankTcbFg: "#A3161A",
  bankTpbBg: "#F3E8FF",
  bankTpbFg: "#6B2FB3",
  switchOff: "#D5D9DF",
} as const;

/** Background/foreground pairs for the initials tile of an app row (docs/design PaymentApps). */
export const tileColors = [
  { bg: "#E0ECFF", fg: "#1D4E9E" },
  { bg: "#F3E8FF", fg: "#6B2FB3" },
  { bg: "#FDE8E8", fg: "#A3161A" },
  { bg: "#FCE7F3", fg: "#9D174D" },
  { bg: "#E0F2F1", fg: "#0F5E57" },
  { bg: "#E3F4E8", fg: "#1E6B37" },
  { bg: "#E0F2FE", fg: "#075985" },
] as const;

/** Translucent colours (not 6-digit hex) used on dark backdrops. */
export const overlays = { button: "rgba(255,255,255,0.14)" } as const;

export const chartColors = ["#0E7C66", "#3B82C4", "#E08A2E", "#8B6BC8", "#A5ABB5"] as const;

export const radii = {
  sm: 10,
  input: 12,
  button: 14,
  card: 16,
  profileCard: 18,
  chip: 18,
  hero: 20,
  sheet: 24,
} as const;

export const fontSize = {
  tab: 11,
  caption: 12,
  secondary: 13,
  body: 14,
  row: 15,
  title: 17,
  heading: 22,
  hero: 32,
} as const;

export const fontFamily = {
  regular: "Inter_400Regular",
  medium: "Inter_500Medium",
  semibold: "Inter_600SemiBold",
  bold: "Inter_700Bold",
  extrabold: "Inter_800ExtraBold",
} as const;

export const layout = {
  screenPadding: 20,
  tabBarHeight: 84,
  qrButtonSize: 60,
} as const;

/** Category tile pairs from the Danh mục design: `fg` is stored on the category, `bg` is its tint. */
export const categoryTiles = [
  { fg: "#0E7C66", bg: "#E7F4F0" },
  { fg: "#A0561A", bg: "#FDF0E3" },
  { fg: "#5E3FA8", bg: "#EFEAFB" },
  { fg: "#245E94", bg: "#E8F1FA" },
  { fg: "#9D174D", bg: "#FCE7F3" },
  { fg: "#7A4300", bg: "#FEF3E2" },
  { fg: "#075985", bg: "#E0F2FE" },
  { fg: "#A3161A", bg: "#FDE8E8" },
  { fg: "#4B5563", bg: "#EEF0F3" },
  { fg: "#6B4423", bg: "#F5EDE4" },
  { fg: "#3F6212", bg: "#ECFCCB" },
] as const;

/** Group icon tile pairs from the Nhóm designs. */
export const groupIconTiles = {
  mountain: { fg: "#0E7C66", bg: "#E7F4F0" },
  sea: { fg: "#245E94", bg: "#E8F1FA" },
  food: { fg: "#A0561A", bg: "#FDF0E3" },
  home: { fg: "#5E3FA8", bg: "#EFEAFB" },
} as const;

/** Member avatar colours: the first is always "Tôi". */
export const memberColors = ["#0E7C66", "#3B82C4", "#E08A2E", "#8B6BC8", "#A5ABB5"] as const;
