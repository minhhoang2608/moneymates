import { vi } from "@/i18n/vi";

const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
const pad = (n: number) => String(n).padStart(2, "0");

export type DayRow = { type: "expense" | "income"; amount: number; occurred_at: string };

export type DayGroup<T extends DayRow> = {
  dayKey: string;
  label: string;
  expenseTotal: number;
  incomeTotal: number;
  rows: T[];
};

function vnDate(ms: number): Date {
  return new Date(ms + VN_OFFSET_MS);
}

/** "YYYY-MM-DD" of an ISO UTC timestamp in Vietnam local time (UTC+7). */
export function dayKeyOf(isoUtc: string): string {
  const t = Date.parse(isoUtc);
  if (Number.isNaN(t)) throw new Error(`Invalid date: ${isoUtc}`);
  const d = vnDate(t);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** "Hôm nay, 22/11" / "Hôm qua, 21/11" / "Thứ 7, 21/11". `today` is a UTC instant. */
export function dayLabel(dayKey: string, today: Date): string {
  const [y, m, d] = dayKey.split("-").map(Number);
  const dayMs = Date.UTC(y, m - 1, d);
  const t = vnDate(today.getTime());
  const todayMs = Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate());
  const diff = Math.round((todayMs - dayMs) / 86_400_000);
  const date = `${pad(d)}/${pad(m)}`;
  if (diff === 0) return `${vi.history.today}, ${date}`;
  if (diff === 1) return `${vi.history.yesterday}, ${date}`;
  return `${vi.history.weekdays[new Date(dayMs).getUTCDay()]}, ${date}`;
}

/** Groups rows by Vietnam-local day, newest day first; rows keep their input order within a day. */
export function groupByDay<T extends DayRow>(rows: T[], today: Date = new Date()): DayGroup<T>[] {
  const map = new Map<string, DayGroup<T>>();
  for (const r of rows) {
    const key = dayKeyOf(r.occurred_at);
    let g = map.get(key);
    if (!g) {
      g = { dayKey: key, label: dayLabel(key, today), expenseTotal: 0, incomeTotal: 0, rows: [] };
      map.set(key, g);
    }
    g.rows.push(r);
    if (r.type === "expense") g.expenseTotal += r.amount;
    else g.incomeTotal += r.amount;
  }
  return [...map.values()].sort((a, b) => (a.dayKey < b.dayKey ? 1 : a.dayKey > b.dayKey ? -1 : 0));
}

/** "HH:mm" in Vietnam local time. */
export function timeOf(isoUtc: string): string {
  const d = vnDate(Date.parse(isoUtc));
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}
