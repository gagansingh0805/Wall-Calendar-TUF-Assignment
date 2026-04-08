import type { DayCell } from "@/components/wall-calendar/types";

const DAY_IN_MS = 24 * 60 * 60 * 1000;

export function startOfDay(date: Date): Date {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

export function addDays(date: Date, days: number): Date {
  const value = startOfDay(date);
  value.setDate(value.getDate() + days);
  return value;
}

export function addMonths(date: Date, months: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + months, date.getDate());
}

export function sameDay(a: Date, b: Date): boolean {
  return startOfDay(a).getTime() === startOfDay(b).getTime();
}

export function isDateBetween(date: Date, start: Date, end: Date): boolean {
  const d = startOfDay(date).getTime();
  const s = startOfDay(start).getTime();
  const e = startOfDay(end).getTime();
  return d >= s && d <= e;
}

export function normalizeRange(start: Date, end: Date): [Date, Date] {
  if (startOfDay(start).getTime() <= startOfDay(end).getTime()) {
    return [startOfDay(start), startOfDay(end)];
  }
  return [startOfDay(end), startOfDay(start)];
}

export function buildCalendarGrid(monthDate: Date): DayCell[] {
  const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const startWeekday = monthStart.getDay();
  const gridStart = new Date(monthStart);
  gridStart.setDate(monthStart.getDate() - startWeekday);

  const cells: DayCell[] = [];
  const today = startOfDay(new Date());

  for (let i = 0; i < 42; i += 1) {
    const date = new Date(gridStart.getTime() + i * DAY_IN_MS);
    cells.push({
      date,
      inCurrentMonth: date.getMonth() === monthDate.getMonth(),
      isToday: sameDay(date, today),
    });
  }

  return cells;
}

export function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function toLocalDateKey(date: Date): string {
  const value = startOfDay(date);
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

export function rangeKey(start: Date | null, end: Date | null): string {
  if (!start || !end) return "no-range";
  const s = toLocalDateKey(start);
  const e = toLocalDateKey(end);
  return `${s}_${e}`;
}

export function formatMonth(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(date);
}

export function formatRangeLabel(start: Date | null, end: Date | null): string {
  if (!start || !end) return "No range selected";
  const s = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(start);
  const e = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(end);
  return `${s} - ${e}`;
}

export function getRangeLengthDays(start: Date | null, end: Date | null): number {
  if (!start || !end) return 0;
  const s = startOfDay(start).getTime();
  const e = startOfDay(end).getTime();
  return Math.floor((e - s) / DAY_IN_MS) + 1;
}

export function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

export function formatDateKey(date: Date): string {
  return toLocalDateKey(date);
}

export function getThisMonthRange(baseDate: Date): [Date, Date] {
  const start = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1);
  const end = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 0);
  return [startOfDay(start), startOfDay(end)];
}

export function getNext7DaysRange(baseDate: Date): [Date, Date] {
  const start = startOfDay(baseDate);
  return [start, addDays(start, 6)];
}

export function getThisWeekendRange(baseDate: Date): [Date, Date] {
  const start = startOfDay(baseDate);
  const day = start.getDay();
  const distanceToSaturday = (6 - day + 7) % 7;
  const saturday = addDays(start, distanceToSaturday);
  const sunday = addDays(saturday, 1);
  return [saturday, sunday];
}

export function getWeekStart(date: Date): Date {
  return addDays(date, -startOfDay(date).getDay());
}

export function getWeekEnd(date: Date): Date {
  return addDays(getWeekStart(date), 6);
}
