/** Encode one TLV field: 2-digit ID + 2-digit decimal length + value. */
export function encodeTlv(id: string, value: string): string {
  if (!/^\d{2}$/.test(id)) {
    throw new RangeError(`TLV id must be 2 digits, got "${id}"`);
  }
  if (value.length > 99) {
    throw new RangeError(`TLV value too long (${value.length} > 99) for id ${id}`);
  }
  return `${id}${String(value.length).padStart(2, "0")}${value}`;
}

export function encodeTlvList(fields: readonly (readonly [string, string])[]): string {
  return fields.map(([id, value]) => encodeTlv(id, value)).join("");
}

export type DecodeTlvResult = { ok: true; fields: Map<string, string> } | { ok: false };

/** Decode a flat TLV string. Never throws; the first occurrence of an ID wins. */
export function decodeTlv(text: string): DecodeTlvResult {
  const fields = new Map<string, string>();
  let i = 0;
  while (i < text.length) {
    const id = text.slice(i, i + 2);
    const len = text.slice(i + 2, i + 4);
    if (!/^\d{2}$/.test(id) || !/^\d{2}$/.test(len)) return { ok: false };
    const start = i + 4;
    const end = start + Number(len);
    if (end > text.length) return { ok: false };
    if (!fields.has(id)) fields.set(id, text.slice(start, end));
    i = end;
  }
  return { ok: true, fields };
}
