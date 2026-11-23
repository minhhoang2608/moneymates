import { groupIconTiles } from "@/theme";

export type GroupIconKey = "mountain" | "sea" | "food" | "home";

export const groupIcons: { key: GroupIconKey; label: string; path: string; fg: string; bg: string }[] = [
  { key: "mountain", label: "Núi", path: "M3 20 9 9l4 6 3-4 5 9z", ...groupIconTiles.mountain },
  {
    key: "sea",
    label: "Biển",
    path: "M2 18c3 0 3-2 5-2s2 2 5 2 3-2 5-2 2 2 5 2M12 4a5 5 0 0 1 5 5H7a5 5 0 0 1 5-5zM12 9v6",
    ...groupIconTiles.sea,
  },
  {
    key: "food",
    label: "Ăn uống",
    path: "M4 11h16M5 11a7 7 0 0 0 14 0M8 4v3M12 3v4M16 4v3",
    ...groupIconTiles.food,
  },
  { key: "home", label: "Nhà", path: "M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z", ...groupIconTiles.home },
];

/** Falls back to the first icon for groups saved with an empty or unknown icon. */
export function groupIconFor(key: string) {
  return groupIcons.find((i) => i.key === key) ?? groupIcons[0];
}
