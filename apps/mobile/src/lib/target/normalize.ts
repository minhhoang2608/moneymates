/** Accent- and case-insensitive form for search: "Phú Quốc" → "phu quoc". */
export function normalizeSearch(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/gi, "d").toLowerCase().trim();
}
