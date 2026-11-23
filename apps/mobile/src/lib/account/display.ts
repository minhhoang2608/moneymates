import { colors } from "../../theme";

export function formatAccountNo(no: string): string {
  return no.replace(/\s+/g, "").replace(/(.{4})(?=.)/g, "$1 ");
}

const TINTS: Record<string, { bg: string; fg: string }> = {
  TCB: { bg: colors.bankTcbBg, fg: colors.bankTcbFg },
  TPB: { bg: colors.bankTpbBg, fg: colors.bankTpbFg },
};

export function bankTint(code: string): { bg: string; fg: string } {
  return TINTS[code] ?? { bg: colors.background, fg: colors.textMuted };
}
