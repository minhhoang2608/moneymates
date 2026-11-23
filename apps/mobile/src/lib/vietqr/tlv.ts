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
