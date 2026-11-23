/** CRC-16/CCITT-FALSE (poly 0x1021, init 0xFFFF) over UTF-8 bytes, 4 uppercase hex chars. */
export function crc16ccitt(input: string): string {
  let crc = 0xffff;
  for (const byte of new TextEncoder().encode(input)) {
    crc ^= byte << 8;
    for (let i = 0; i < 8; i++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

/** True when the payload ends with `6304XXXX` and XXXX is the correct CRC. */
export function hasValidCrc(payload: string): boolean {
  if (payload.length < 8) return false;
  const body = payload.slice(0, -4);
  const crc = payload.slice(-4);
  if (!body.endsWith("6304")) return false;
  return /^[0-9A-F]{4}$/.test(crc) && crc16ccitt(body) === crc;
}
