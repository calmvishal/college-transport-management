/** Formats a Date as yyyy-MM-dd, which is the canonical date-string format
 * used everywhere in the sheets (Travel Date, Date, etc.) so string
 * comparisons/filters work without ambiguity. */
export function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Returns today's date key in the app's configured timezone. Falls back
 * to server local time if APP_TIMEZONE isn't parseable in this runtime. */
export function todayKey(): string {
  const tz = process.env.APP_TIMEZONE || "UTC";
  try {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    return formatter.format(new Date()); // en-CA gives yyyy-MM-dd
  } catch {
    return toDateKey(new Date());
  }
}

/** The single date students are allowed to book for: tomorrow, relative to
 * "today" in the app's configured timezone. */
export function nextBookableDateKey(): string {
  const today = todayKey();
  const [y, m, d] = today.split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + 1));
  return toDateKey(next);
}

export function formatDisplayDate(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

export function addDays(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return toDateKey(date);
}

export function isPastDate(dateKey: string): boolean {
  return dateKey < todayKey();
}

/** Returns yyyy-MM start/end date keys for a given "yyyy-MM" month string,
 * used by the monthly report generator. */
export function monthRange(yearMonth: string): { start: string; end: string } {
  const [y, m] = yearMonth.split("-").map(Number);
  const start = `${y}-${String(m).padStart(2, "0")}-01`;
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const end = `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { start, end };
}
