import { vi } from "@/i18n/vi";

const t = vi.groupDetail;

/** Row subtitle: "Tôi trả · chia đều 4". The payer is "Tôi" when it is me. */
export function expenseLine(opts: {
  payerName: string;
  payerIsMe: boolean;
  splitMode: string | null;
  shareCount: number;
}): string {
  const payer = opts.payerIsMe ? vi.groups.me : opts.payerName;
  const label = t.splitLabels[(opts.splitMode ?? "equal") as keyof typeof t.splitLabels] ?? t.splitLabels.equal;
  return `${payer} ${t.paid} · ${label} ${opts.shareCount}`;
}
