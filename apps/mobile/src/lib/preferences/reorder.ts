/** Returns a copy of `list` with the item at `from` moved to `to` (indices are clamped). */
export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  const next = [...list];
  if (from < 0 || from >= next.length) return next;
  const target = Math.max(0, Math.min(next.length - 1, to));
  if (target === from) return next;
  const [item] = next.splice(from, 1);
  next.splice(target, 0, item);
  return next;
}

/** Index a row ends on after being dragged `dy` pixels, clamped to the list. */
export function targetIndex(from: number, dy: number, rowHeight: number, length: number): number {
  return Math.max(0, Math.min(length - 1, from + Math.round(dy / rowHeight)));
}
