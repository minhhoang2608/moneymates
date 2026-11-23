import type { CategoryRow } from "@/db/repositories";
import { suggestCategory } from "@/lib/category";

export const OTHER_NAME = "Khác";

export type InitialCategory = { id: string | null; source: "keyword" | "fallback" };

/** Keyword match (#65) mapped to the user's expense category by name, else "Khác". Pure. */
export function pickInitialCategory(
  rows: CategoryRow[],
  recipientName: string | null | undefined,
  message: string | null | undefined,
): InitialCategory {
  const hit = suggestCategory(recipientName, message);
  const match = hit ? rows.find((c) => c.name === hit.name) : undefined;
  if (match) return { id: match.id, source: "keyword" };
  return { id: rows.find((c) => c.name === OTHER_NAME)?.id ?? rows[0]?.id ?? null, source: "fallback" };
}

/** Text sent to the AI: transfer message plus recipient name. */
export function aiText(recipientName: string | null | undefined, message: string | null | undefined): string {
  return `${message ?? ""} ${recipientName ?? ""}`.trim();
}
