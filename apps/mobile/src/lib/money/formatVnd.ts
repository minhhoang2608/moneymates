/** Formats integer VND as "1.200.000đ". */
export function formatVnd(n: number): string {
  if (!Number.isSafeInteger(n)) {
    throw new RangeError(`formatVnd expects a safe integer, got ${n}`);
  }
  const digits = String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${n < 0 ? "-" : ""}${digits}đ`;
}
