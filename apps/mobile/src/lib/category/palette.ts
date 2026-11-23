import { categoryTiles, colors } from "../../theme";

export const CATEGORY_COLORS: readonly string[] = categoryTiles.map((t) => t.fg);

/** Background tint for a stored foreground colour; neutral tint for unknown colours. */
export function tintFor(color: string): string {
  return categoryTiles.find((t) => t.fg.toLowerCase() === color.toLowerCase())?.bg ?? colors.divider;
}
