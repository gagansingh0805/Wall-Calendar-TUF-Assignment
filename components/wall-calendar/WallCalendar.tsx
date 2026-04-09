"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties, type MouseEvent, type SyntheticEvent } from "react";
import { CalendarGrid } from "@/components/wall-calendar/CalendarGrid";
import { NotesPanel } from "@/components/wall-calendar/NotesPanel";
import type {
  DateRange,
  RangeBadge,
  RangeNoteEntry,
  RecurringReminderRule,
  SavedRangeNote,
  StoredNoteMap,
  StoredRangeBadgeMap,
  StoredRangeNoteMap,
  StoredRangeNoteValue,
  StoredSavedRangeNotesMap,
  StoredRecurringReminderMap,
  WeekdayCode,
} from "@/components/wall-calendar/types";
import {
  addDays,
  formatDateKey,
  formatMonth,
  formatRangeLabel,
  getNext7DaysRange,
  getRangeLengthDays,
  getThisMonthRange,
  getThisWeekendRange,
  isDateBetween,
  monthKey,
  normalizeDateKeyRange,
  normalizeRange,
  parseLocalDateKey,
  rangeKey,
  sameDay,
  startOfDay,
  toLocalDateKey,
} from "@/lib/date";
import { parseMemoItems } from "@/lib/memo-items";

const MONTH_NOTES_STORAGE_KEY = "wall-calendar-month-notes";
const RANGE_NOTES_STORAGE_KEY = "wall-calendar-range-notes";
const SAVED_RANGE_NOTES_STORAGE_KEY = "wall-calendar-saved-range-notes";
const RANGE_BADGES_STORAGE_KEY = "wall-calendar-range-badges";
const RECURRING_REMINDERS_STORAGE_KEY = "wall-calendar-recurring-reminders";
type ActivityScope = "ongoing" | "tomorrow" | "7d" | "30d";

const FALLBACK_GIFS = [
  "https://media.giphy.com/media/3o7TKtnuHOHHUjR38Y/giphy.gif",
  "https://media.giphy.com/media/l0HlBO7eyXzSZkJri/giphy.gif",
];
type ThemeName = "ocean" | "sunset" | "midnight";
type DynamicAccent = {
  accent: string;
  deepAccent: string;
} | null;
type HolidayRecord = { date: string; name: string };
type HolidayTier = "major" | "minor";
type HeroParallax = { x: number; y: number };

type ReminderDraft = {
  text: string;
  freq: "daily" | "weekly" | "monthly";
  interval: number;
  byMonthDay: string;
  byWeekday: WeekdayCode[];
  count: string;
  until: string;
};

function useStoredMap(storageKey: string) {
  const [state, setState] = useState<StoredNoteMap>(() => {
    if (typeof window === "undefined") return {};
    const saved = localStorage.getItem(storageKey);
    return saved ? (JSON.parse(saved) as StoredNoteMap) : {};
  });

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(state));
  }, [storageKey, state]);

  return [state, setState] as const;
}

function migrateRangeNote(value: StoredRangeNoteValue | undefined): RangeNoteEntry {
  if (!value) return { fromDate: "", toDate: "", title: "", description: "", tag: "", priority: "medium" };
  if (typeof value === "string") return { fromDate: "", toDate: "", title: "", description: value, tag: "", priority: "medium" };
  return {
    fromDate: value.fromDate ?? "",
    toDate: value.toDate ?? "",
    title: value.title ?? "",
    description: value.description ?? "",
    tag: value.tag ?? "",
    priority: value.priority ?? "medium",
  };
}

function useStoredObject<T>(storageKey: string, fallback: T) {
  const [state, setState] = useState<T>(() => {
    if (typeof window === "undefined") return fallback;
    const saved = localStorage.getItem(storageKey);
    return saved ? (JSON.parse(saved) as T) : fallback;
  });

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(state));
  }, [storageKey, state]);

  return [state, setState] as const;
}

function guessRangeBadge(start: Date, end: Date): Pick<RangeBadge, "kind" | "label"> {
  const length = getRangeLengthDays(start, end);
  const coversWeekend = [0, 6].includes(start.getDay()) || [0, 6].includes(end.getDay());
  if (coversWeekend && length <= 3) return { kind: "Trip", label: "Trip" };
  if (length <= 4) return { kind: "Exam", label: "Exam" };
  return { kind: "Sprint", label: "Sprint" };
}

function parseDateKey(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
}

function weekdayCode(date: Date): WeekdayCode {
  return ["SU", "MO", "TU", "WE", "TH", "FR", "SA"][date.getDay()] as WeekdayCode;
}

function occursOnDate(rule: RecurringReminderRule, date: Date): boolean {
  const target = startOfDay(date);
  const start = parseDateKey(rule.startDate);
  if (target.getTime() < start.getTime()) return false;
  if (rule.until) {
    const until = parseDateKey(rule.until);
    if (target.getTime() > until.getTime()) return false;
  }

  const elapsedDays = Math.floor((target.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
  const elapsedWeeks = Math.floor(elapsedDays / 7);
  const elapsedMonths = (target.getFullYear() - start.getFullYear()) * 12 + (target.getMonth() - start.getMonth());

  if (rule.freq === "daily" && elapsedDays % rule.interval !== 0) return false;
  if (rule.freq === "weekly" && elapsedWeeks % rule.interval !== 0) return false;
  if (rule.freq === "monthly" && elapsedMonths % rule.interval !== 0) return false;

  if (rule.byWeekday?.length && !rule.byWeekday.includes(weekdayCode(target))) return false;
  if (rule.byMonthDay?.length && !rule.byMonthDay.includes(target.getDate())) return false;

  if (rule.count && rule.count > 0) {
    let seen = 0;
    for (let i = 0; i <= elapsedDays; i += 1) {
      const candidate = new Date(start);
      candidate.setDate(start.getDate() + i);
      if (occursOnDate({ ...rule, count: undefined }, candidate)) {
        seen += 1;
      }
      if (sameDay(candidate, target)) break;
    }
    if (seen > rule.count) return false;
  }

  return true;
}

function useTheme(theme: ThemeName) {
  useEffect(() => {
    document.body.setAttribute("data-calendar-theme", theme);
    return () => document.body.removeAttribute("data-calendar-theme");
  }, [theme]);
}

function useHeroGifLoader() {
  const [heroGif, setHeroGif] = useState<string>(FALLBACK_GIFS[0]);
  const [isLoadingGif, setIsLoadingGif] = useState<boolean>(false);
  const [isRibbonStretching, setIsRibbonStretching] = useState<boolean>(false);

  const loadGifFromApi = useCallback(async (currentGif?: string) => {
    setIsLoadingGif(true);
    try {
      let nextUrl: string | undefined;

      for (let i = 0; i < 3; i += 1) {
        const response = await fetch(`/api/gif?t=${Date.now()}-${i}`, { cache: "no-store" });
        const data = (await response.json()) as { url?: string };
        if (data.url && data.url !== currentGif) {
          nextUrl = data.url;
          break;
        }
      }

      if (nextUrl) {
        setHeroGif(nextUrl);
      } else {
        const fallback = FALLBACK_GIFS[Math.floor(Math.random() * FALLBACK_GIFS.length)];
        setHeroGif(
          fallback === currentGif ? FALLBACK_GIFS[(FALLBACK_GIFS.indexOf(fallback) + 1) % FALLBACK_GIFS.length] : fallback,
        );
      }
    } catch {
      setHeroGif(FALLBACK_GIFS[Math.floor(Math.random() * FALLBACK_GIFS.length)]);
    } finally {
      setIsLoadingGif(false);
    }
  }, []);

  useEffect(() => {
    void loadGifFromApi();
  }, [loadGifFromApi]);

  const onRibbonTap = useCallback(async () => {
    if (isLoadingGif) return;
    setIsRibbonStretching(true);
    await loadGifFromApi(heroGif);
  }, [heroGif, isLoadingGif, loadGifFromApi]);

  const onRibbonAnimationEnd = useCallback(() => {
    setIsRibbonStretching(false);
  }, []);

  return { heroGif, isLoadingGif, isRibbonStretching, onRibbonTap, onRibbonAnimationEnd };
}

function hslFromRgb(r: number, g: number, b: number) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;
  let h = 0;
  const l = (max + min) / 2;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));

  if (d !== 0) {
    switch (max) {
      case rn:
        h = ((gn - bn) / d) % 6;
        break;
      case gn:
        h = (bn - rn) / d + 2;
        break;
      default:
        h = (rn - gn) / d + 4;
    }
  }

  return { h: Math.round(h * 60 < 0 ? h * 60 + 360 : h * 60), s, l };
}

function bucketAccentColor(hue: number): { accent: string; deepAccent: string } {
  if (hue >= 25 && hue <= 45) {
    return { accent: "hsl(31 95% 56%)", deepAccent: "hsl(24 90% 46%)" };
  }
  if (hue >= 160 && hue <= 190) {
    return { accent: "hsl(181 70% 45%)", deepAccent: "hsl(186 78% 33%)" };
  }
  return { accent: "hsl(202 89% 56%)", deepAccent: "hsl(214 86% 44%)" };
}

function classifyHolidayTier(name: string): HolidayTier {
  const normalized = name.toLowerCase();
  const majorMatchers = [
    "diwali",
    "holi",
    "dussehra",
    "durga puja",
    "eid",
    "christmas",
    "navratri",
    "ganesh chaturthi",
    "janmashtami",
    "guru nanak",
    "independence day",
    "republic day",
  ];
  return majorMatchers.some((matcher) => normalized.includes(matcher)) ? "major" : "minor";
}

function suggestThemeFromHue(hue: number): ThemeName {
  if (hue >= 20 && hue <= 62) return "sunset";
  if (hue >= 170 && hue <= 250) return "ocean";
  return "midnight";
}

export function WallCalendar() {
  const [viewDate, setViewDate] = useState<Date>(new Date());
  const [theme, setTheme] = useState<ThemeName>("midnight");
  const [dynamicAccent, setDynamicAccent] = useState<DynamicAccent>(null);
  const [suggestedTheme, setSuggestedTheme] = useState<ThemeName | null>(null);
  const [heroParallax, setHeroParallax] = useState<HeroParallax>({ x: 0, y: 0 });
  const [range, setRange] = useState<DateRange>({ start: null, end: null });
  const [holidaysByYear, setHolidaysByYear] = useState<Record<number, HolidayRecord[]>>({});
  const [activeAction, setActiveAction] = useState<"monthMemo" | "rangeNote" | "recurring" | "holidays">("monthMemo");
  const [monthNotes, setMonthNotes] = useStoredMap(MONTH_NOTES_STORAGE_KEY);
  const [rangeNotes, setRangeNotes] = useStoredObject<StoredRangeNoteMap>(RANGE_NOTES_STORAGE_KEY, {});
  const [savedRangeNotesByMonth, setSavedRangeNotesByMonth] = useStoredObject<StoredSavedRangeNotesMap>(
    SAVED_RANGE_NOTES_STORAGE_KEY,
    {},
  );
  const [, setRangeBadges] = useStoredObject<StoredRangeBadgeMap>(RANGE_BADGES_STORAGE_KEY, {});
  const [recurringReminders, setRecurringReminders] = useStoredObject<StoredRecurringReminderMap>(RECURRING_REMINDERS_STORAGE_KEY, {});
  const [activityScope, setActivityScope] = useState<ActivityScope>("7d");
  const [reminderDraft, setReminderDraft] = useState<ReminderDraft>({
    text: "",
    freq: "monthly",
    interval: 1,
    byMonthDay: "",
    byWeekday: [],
    count: "",
    until: "",
  });
  const { heroGif, isLoadingGif, isRibbonStretching, onRibbonTap, onRibbonAnimationEnd } = useHeroGifLoader();
  useTheme(theme);

  useEffect(() => {
    if (activeAction !== "monthMemo") return;
    setRange((prev) => {
      if (!prev.start || !prev.end) return prev;
      if (sameDay(prev.start, prev.end)) return prev;
      const d = startOfDay(prev.end);
      return { start: d, end: d };
    });
  }, [activeAction]);

  const monthId = monthKey(viewDate);
  const rangeId = rangeKey(range.start, range.end);
  const monthNote = monthNotes[monthId] ?? "";
  const selectedRangeNote = migrateRangeNote(rangeNotes[`${monthId}_${rangeId}`]);
  const monthLabel = useMemo(() => formatMonth(viewDate), [viewDate]);
  const monthName = useMemo(
    () => new Intl.DateTimeFormat("en-US", { month: "long" }).format(viewDate).toUpperCase(),
    [viewDate],
  );
  const rangeLabel = useMemo(() => formatRangeLabel(range.start, range.end), [range.start, range.end]);
  /** YYYY-MM-DD for Month Memo due field: anchor day while choosing range, range end once complete. */
  const calendarDueDateKey = useMemo(() => {
    if (!range.start) return null;
    if (range.end) return toLocalDateKey(range.end);
    return toLocalDateKey(range.start);
  }, [range.start, range.end]);
  /** Stable fingerprint so range-note From/To sync when calendar selection changes without effect churn. */
  const calendarSelectionFingerprint = useMemo(() => {
    if (!range.start || !range.end) return null;
    return `${toLocalDateKey(range.start)}_${toLocalDateKey(range.end)}`;
  }, [range.start, range.end]);
  const rangeLength = useMemo(() => getRangeLengthDays(range.start, range.end), [range.start, range.end]);
  const holidaysThisMonth = useMemo(() => {
    const yearHolidays = holidaysByYear[viewDate.getFullYear()] ?? [];
    const month = viewDate.getMonth();
    return yearHolidays
      .map((holiday) => ({ date: new Date(holiday.date), label: holiday.name, tier: classifyHolidayTier(holiday.name) }))
      .filter((holiday) => holiday.date.getMonth() === month)
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [holidaysByYear, viewDate]);
  const currentYearHolidays = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const yearHolidays = holidaysByYear[currentYear] ?? [];
    return yearHolidays
      .map((holiday) => ({ date: new Date(holiday.date), label: holiday.name, tier: classifyHolidayTier(holiday.name) }))
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [holidaysByYear]);
  const holidayTierByDate = useMemo(() => {
    const tierMap: Record<string, HolidayTier> = {};
    holidaysThisMonth.forEach((holiday) => {
      const key = formatDateKey(holiday.date);
      if (holiday.tier === "major" || !tierMap[key]) {
        tierMap[key] = holiday.tier;
      }
    });
    return tierMap;
  }, [holidaysThisMonth]);
  const holidayLabelsByDate = useMemo(() => {
    const labelsByKey: Record<string, string[]> = {};
    holidaysThisMonth.forEach((holiday) => {
      const key = formatDateKey(holiday.date);
      if (!labelsByKey[key]) labelsByKey[key] = [];
      labelsByKey[key].push(holiday.label);
    });
    const merged: Record<string, string> = {};
    Object.entries(labelsByKey).forEach(([key, labels]) => {
      merged[key] = [...new Set(labels)].join(" · ");
    });
    return merged;
  }, [holidaysThisMonth]);
  const monthTransitionKey = useMemo(() => monthKey(viewDate), [viewDate]);
  const remindersForMonth = recurringReminders[monthId] ?? [];
  const savedRangeNotesForMonth = savedRangeNotesByMonth[monthId] ?? [];
  const reminderInstances = useMemo(() => {
    const daysInMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate();
    const instances: Array<{ id: string; text: string; date: Date }> = [];
    for (let day = 1; day <= daysInMonth; day += 1) {
      const candidate = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
      remindersForMonth.forEach((rule) => {
        if (occursOnDate(rule, candidate)) {
          instances.push({ id: rule.id, text: rule.text, date: candidate });
        }
      });
    }
    return instances;
  }, [remindersForMonth, viewDate]);
  const allRecurringRules = useMemo(() => Object.values(recurringReminders).flat(), [recurringReminders]);
  type ActivityFeedRow = {
    id: string;
    kind: "memo" | "range" | "recurring" | "holiday";
    sortKey: number;
    primary: string;
    detail: string;
    dateLabel: string;
  };
  const ongoingActivityItems = useMemo(() => {
    const today = startOfDay(new Date());
    const tt = today.getTime();
    const dateFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
    const rows: ActivityFeedRow[] = [];

    Object.entries(monthNotes).forEach(([mKey, raw]) => {
      parseMemoItems(raw).forEach((memo) => {
        if (memo.done || !memo.dueDate.trim()) return;
        const due = parseLocalDateKey(memo.dueDate.trim());
        if (!due || !sameDay(due, today)) return;
        rows.push({
          id: `ongoing-memo-${mKey}-${memo.id}`,
          kind: "memo",
          sortKey: tt,
          primary: memo.text.trim() || "(Untitled memo)",
          detail: "Memo",
          dateLabel: "Due today",
        });
      });
    });

    Object.values(savedRangeNotesByMonth).forEach((list) => {
      list.forEach((note) => {
        const from = parseLocalDateKey(note.fromDate);
        const to = parseLocalDateKey(note.toDate);
        if (!from || !to) return;
        const fs = startOfDay(from).getTime();
        const fe = startOfDay(to).getTime();
        if (tt < fs || tt > fe) return;
        rows.push({
          id: `ongoing-range-${note.id}`,
          kind: "range",
          sortKey: fe,
          primary: note.title.trim() || "(Range note)",
          detail: "Range",
          dateLabel: `${dateFmt.format(from)}–${dateFmt.format(to)}`,
        });
      });
    });

    allRecurringRules.forEach((rule) => {
      if (occursOnDate(rule, today)) {
        rows.push({
          id: `ongoing-rec-${rule.id}-${toLocalDateKey(today)}`,
          kind: "recurring",
          sortKey: tt,
          primary: rule.text,
          detail: "Recurring",
          dateLabel: "Today",
        });
      }
    });

    const yToday = today.getFullYear();
    (holidaysByYear[yToday] ?? []).forEach((h) => {
      const parsed = new Date(h.date);
      if (Number.isNaN(parsed.getTime())) return;
      const d = startOfDay(parsed);
      if (!sameDay(d, today)) return;
      rows.push({
        id: `ongoing-holiday-${toLocalDateKey(d)}-${h.name}`,
        kind: "holiday",
        sortKey: tt,
        primary: h.name,
        detail: "Holiday",
        dateLabel: "Today",
      });
    });

    rows.sort((a, b) => {
      const c = a.sortKey - b.sortKey;
      if (c !== 0) return c;
      return a.primary.localeCompare(b.primary, undefined, { sensitivity: "base" });
    });
    return rows;
  }, [allRecurringRules, holidaysByYear, monthNotes, savedRangeNotesByMonth]);

  const upcomingActivityItems = useMemo(() => {
    if (activityScope === "ongoing") return [];
    const today = startOfDay(new Date());
    let windowStart: Date;
    let windowEnd: Date;
    if (activityScope === "tomorrow") {
      windowStart = addDays(today, 1);
      windowEnd = addDays(today, 1);
    } else if (activityScope === "7d") {
      windowStart = addDays(today, 1);
      windowEnd = addDays(today, 7);
    } else {
      windowStart = addDays(today, 1);
      windowEnd = addDays(today, 30);
    }
    const ws = windowStart.getTime();
    const we = windowEnd.getTime();
    const dateFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
    const rows: ActivityFeedRow[] = [];

    Object.entries(monthNotes).forEach(([mKey, raw]) => {
      parseMemoItems(raw).forEach((memo) => {
        if (memo.done || !memo.dueDate.trim()) return;
        const due = parseLocalDateKey(memo.dueDate.trim());
        if (!due) return;
        const t = startOfDay(due).getTime();
        if (t < ws || t > we) return;
        rows.push({
          id: `memo-${mKey}-${memo.id}-${memo.dueDate}`,
          kind: "memo",
          sortKey: t,
          primary: memo.text.trim() || "(Untitled memo)",
          detail: "Memo",
          dateLabel: dateFmt.format(due),
        });
      });
    });

    Object.values(savedRangeNotesByMonth).forEach((list) => {
      list.forEach((note) => {
        const from = parseLocalDateKey(note.fromDate);
        const to = parseLocalDateKey(note.toDate);
        if (!from || !to) return;
        const fs = startOfDay(from).getTime();
        const fe = startOfDay(to).getTime();
        if (fe < ws || fs > we) return;
        rows.push({
          id: `range-${note.id}`,
          kind: "range",
          sortKey: fs,
          primary: note.title.trim() || "(Range note)",
          detail: "Range",
          dateLabel: `${dateFmt.format(from)}–${dateFmt.format(to)}`,
        });
      });
    });

    allRecurringRules.forEach((rule) => {
      for (let t = ws; t <= we; t += 24 * 60 * 60 * 1000) {
        const d = new Date(t);
        if (occursOnDate(rule, d)) {
          rows.push({
            id: `rec-${rule.id}-${toLocalDateKey(d)}`,
            kind: "recurring",
            sortKey: t,
            primary: rule.text,
            detail: "Recurring",
            dateLabel: dateFmt.format(d),
          });
        }
      }
    });

    const y0 = windowStart.getFullYear();
    const y1 = windowEnd.getFullYear();
    for (let y = y0; y <= y1; y += 1) {
      const list = holidaysByYear[y] ?? [];
      list.forEach((h) => {
        const parsed = new Date(h.date);
        if (Number.isNaN(parsed.getTime())) return;
        const d = startOfDay(parsed);
        const t = d.getTime();
        if (t < ws || t > we) return;
        rows.push({
          id: `holiday-${toLocalDateKey(d)}-${h.name}`,
          kind: "holiday",
          sortKey: t,
          primary: h.name,
          detail: "Holiday",
          dateLabel: dateFmt.format(d),
        });
      });
    }

    rows.sort((a, b) => {
      const c = a.sortKey - b.sortKey;
      if (c !== 0) return c;
      return a.primary.localeCompare(b.primary, undefined, { sensitivity: "base" });
    });
    return rows;
  }, [activityScope, allRecurringRules, holidaysByYear, monthNotes, savedRangeNotesByMonth]);

  const activityDisplayRows = useMemo(
    () => (activityScope === "ongoing" ? ongoingActivityItems : upcomingActivityItems),
    [activityScope, ongoingActivityItems, upcomingActivityItems],
  );

  const activityEmptyLabel =
    activityScope === "ongoing"
      ? "Nothing ongoing today."
      : activityScope === "tomorrow"
        ? "Nothing scheduled for tomorrow."
        : activityScope === "7d"
          ? "Nothing in the next 7 days."
          : "Nothing in the next 30 days.";

  const liveSummary = useMemo(() => {
    const rangeText = range.start && range.end ? `${formatRangeLabel(range.start, range.end)}, ${rangeLength} days` : "No range selected";
    return `${rangeText}. ${reminderInstances.length} reminder occurrence${reminderInstances.length === 1 ? "" : "s"} this month.`;
  }, [range.end, range.start, rangeLength, reminderInstances.length]);
  const monthOptions = useMemo(
    () =>
      Array.from({ length: 12 }, (_, index) => ({
        value: index,
        label: new Intl.DateTimeFormat("en-US", { month: "long" }).format(new Date(2024, index, 1)),
      })),
    [],
  );
  const yearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 21 }, (_, index) => currentYear - 10 + index);
  }, []);

  /** Keep Range Note From/To aligned with the main calendar selection as it changes. */
  useEffect(() => {
    if (!calendarSelectionFingerprint) return;
    const [fromStr, toStr] = calendarSelectionFingerprint.split("_");
    if (!fromStr || !toStr) return;
    const storageKey = `${monthId}_${calendarSelectionFingerprint}`;
    setRangeNotes((prev) => {
      const current = migrateRangeNote(prev[storageKey]);
      if (current.fromDate === fromStr && current.toDate === toStr) return prev;
      return { ...prev, [storageKey]: { ...current, fromDate: fromStr, toDate: toStr } };
    });
  }, [monthId, calendarSelectionFingerprint, setRangeNotes]);

  useEffect(() => {
    const centerYear = viewDate.getFullYear();
    const targetYears = Array.from({ length: 21 }, (_, index) => centerYear - 10 + index).filter(
      (year) => !holidaysByYear[year],
    );
    if (targetYears.length === 0) return;

    let isCancelled = false;
    async function fetchHolidayYears() {
      const requests = targetYears.map(async (year) => {
        try {
          const response = await fetch(`/api/holidays?year=${year}`, { cache: "no-store" });
          const data = (await response.json()) as { holidays?: HolidayRecord[] };
          return { year, holidays: data.holidays ?? [] };
        } catch {
          return { year, holidays: [] };
        }
      });
      const results = await Promise.all(requests);
      if (isCancelled) return;
      setHolidaysByYear((prev) => {
        const next = { ...prev };
        results.forEach((item) => {
          next[item.year] = item.holidays;
        });
        return next;
      });
    }

    void fetchHolidayYears();
    return () => {
      isCancelled = true;
    };
  }, [holidaysByYear, viewDate]);

  function moveMonth(delta: number) {
    setViewDate((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1));
  }

  function onMonthSelect(month: number) {
    setViewDate((current) => new Date(current.getFullYear(), month, 1));
  }

  function onYearSelect(year: number) {
    setViewDate((current) => new Date(year, current.getMonth(), 1));
  }

  function clearSelection() {
    setRange({ start: null, end: null });
  }

  function onSelectDate(date: Date) {
    const clicked = startOfDay(date);
    if (activeAction === "monthMemo") {
      setRange({ start: clicked, end: clicked });
      return;
    }

    if (!range.start) {
      setRange({ start: date, end: null });
      return;
    }

    if (range.start && !range.end && sameDay(range.start, date)) {
      clearSelection();
      return;
    }

    if (range.start && range.end) {
      const clicked = startOfDay(date);
      const anchoredStart = startOfDay(range.start);
      if (isDateBetween(clicked, range.start, range.end)) {
        clearSelection();
        return;
      }
      if (sameDay(clicked, anchoredStart)) {
        clearSelection();
        return;
      }
      if (clicked.getTime() >= anchoredStart.getTime()) {
        setRange({ start: anchoredStart, end: clicked });
      } else {
        const [start, end] = normalizeRange(anchoredStart, clicked);
        setRange({ start, end });
      }
      return;
    }

    const [start, end] = normalizeRange(range.start, date);
    setRange({ start, end });
    setRangeBadges((prev) => {
      const next = { ...prev };
      const key = rangeKey(start, end);
      if (!next[key]) {
        const smart = guessRangeBadge(start, end);
        next[key] = { ...smart, source: "auto" };
      }
      return next;
    });
  }

  function onSelectRange(startDate: Date, endDate: Date) {
    if (activeAction === "monthMemo") return;
    const [start, end] = normalizeRange(startDate, endDate);
    setRange({ start, end });
    setRangeBadges((prev) => {
      const next = { ...prev };
      const key = rangeKey(start, end);
      if (!next[key]) {
        const smart = guessRangeBadge(start, end);
        next[key] = { ...smart, source: "auto" };
      }
      return next;
    });
  }

  function applyPreset(preset: "weekend" | "next7" | "month") {
    if (activeAction === "monthMemo") return;
    const [start, end] =
      preset === "weekend" ? getThisWeekendRange(viewDate) : preset === "next7" ? getNext7DaysRange(viewDate) : getThisMonthRange(viewDate);
    if (range.start && range.end && sameDay(range.start, start) && sameDay(range.end, end)) {
      clearSelection();
      return;
    }
    onSelectRange(start, end);
  }

  function onReminderDraftChange(patch: Partial<ReminderDraft>) {
    setReminderDraft((prev) => ({ ...prev, ...patch }));
  }

  function onAddRecurringReminder() {
    if (!reminderDraft.text.trim()) return;
    const monthDays = reminderDraft.byMonthDay
      .split(",")
      .map((item) => Number(item.trim()))
      .filter((value) => Number.isFinite(value) && value >= 1 && value <= 31);
    const nextRule: RecurringReminderRule = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      text: reminderDraft.text.trim(),
      freq: reminderDraft.freq,
      interval: Math.max(1, reminderDraft.interval),
      byMonthDay: monthDays.length ? monthDays : undefined,
      byWeekday: reminderDraft.byWeekday.length ? reminderDraft.byWeekday : undefined,
      count: reminderDraft.count ? Math.max(1, Number(reminderDraft.count)) : undefined,
      until: reminderDraft.until || undefined,
      startDate: toLocalDateKey(range.start ?? new Date()),
    };
    setRecurringReminders((prev) => ({ ...prev, [monthId]: [...(prev[monthId] ?? []), nextRule] }));
    setReminderDraft((prev) => ({ ...prev, text: "", count: "", until: "" }));
  }

  function onDeleteRecurringReminder(id: string) {
    setRecurringReminders((prev) => ({ ...prev, [monthId]: (prev[monthId] ?? []).filter((item) => item.id !== id) }));
  }

  function onJumpToDate(date: Date) {
    setViewDate(new Date(date.getFullYear(), date.getMonth(), 1));
  }

  function onDoubleClickDate(date: Date) {
    if (!range.start || !range.end) return;
    if (isDateBetween(date, range.start, range.end)) {
      clearSelection();
    }
  }

  function onMonthNoteChange(value: string) {
    setMonthNotes((prev) => ({ ...prev, [monthId]: value }));
  }

  function onRangeNoteChangePatch(patch: Partial<RangeNoteEntry>) {
    setRangeNotes((prev) => {
      const key = `${monthId}_${rangeId}`;
      const current = migrateRangeNote(prev[key]);
      const merged = { ...current, ...patch };
      if (merged.fromDate && merged.toDate) {
        const normalized = normalizeDateKeyRange(merged.fromDate, merged.toDate);
        merged.fromDate = normalized.fromDate;
        merged.toDate = normalized.toDate;
      }
      return { ...prev, [key]: merged };
    });
  }

  function onSaveRangeNote(note: RangeNoteEntry) {
    if (!note.title.trim()) return;
    const from = note.fromDate.trim();
    const to = note.toDate.trim();
    if (!from || !to) return;
    const normalized = normalizeDateKeyRange(from, to);
    const id =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `saved-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const entry: SavedRangeNote = {
      id,
      savedAt: new Date().toISOString(),
      ...note,
      fromDate: normalized.fromDate,
      toDate: normalized.toDate,
    };
    setSavedRangeNotesByMonth((prev) => ({
      ...prev,
      [monthId]: [entry, ...(prev[monthId] ?? [])],
    }));
  }

  function onDeleteSavedRangeNote(id: string) {
    setSavedRangeNotesByMonth((prev) => ({
      ...prev,
      [monthId]: (prev[monthId] ?? []).filter((item) => item.id !== id),
    }));
  }

  function onUpdateSavedRangeNote(id: string, patch: Partial<RangeNoteEntry>) {
    setSavedRangeNotesByMonth((prev) => {
      const list = prev[monthId] ?? [];
      const item = list.find((entry) => entry.id === id);
      if (!item) return prev;
      const merged: SavedRangeNote = { ...item, ...patch };
      if (!merged.title.trim()) return prev;
      const from = merged.fromDate?.trim() ?? "";
      const to = merged.toDate?.trim() ?? "";
      if (from && to) {
        const normalized = normalizeDateKeyRange(from, to);
        merged.fromDate = normalized.fromDate;
        merged.toDate = normalized.toDate;
      }
      return {
        ...prev,
        [monthId]: list.map((entry) => (entry.id === id ? merged : entry)),
      };
    });
  }

  function onHeroImageLoad(event: SyntheticEvent<HTMLImageElement>) {
    try {
      const img = event.currentTarget;
      const canvas = document.createElement("canvas");
      const sampleSize = 28;
      canvas.width = sampleSize;
      canvas.height = sampleSize;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, sampleSize, sampleSize);
      const { data } = ctx.getImageData(0, 0, sampleSize, sampleSize);

      let sumR = 0;
      let sumG = 0;
      let sumB = 0;
      let count = 0;
      for (let i = 0; i < data.length; i += 16) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];
        if (a < 160) continue;
        sumR += r;
        sumG += g;
        sumB += b;
        count += 1;
      }
      if (count === 0) return;
      const avgR = Math.round(sumR / count);
      const avgG = Math.round(sumG / count);
      const avgB = Math.round(sumB / count);
      const { h } = hslFromRgb(avgR, avgG, avgB);
      setDynamicAccent(bucketAccentColor(h));
      setSuggestedTheme(suggestThemeFromHue(h));
    } catch {
      setDynamicAccent(null);
      setSuggestedTheme(null);
    }
  }

  function onHeroMouseMove(event: MouseEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
    const y = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
    setHeroParallax({ x, y });
  }

  function onHeroMouseLeave() {
    setHeroParallax({ x: 0, y: 0 });
  }

  return (
    <section
      data-theme={theme}
      style={
        dynamicAccent
          ? ({ "--theme-accent": dynamicAccent.accent, "--theme-accent-deep": dynamicAccent.deepAccent } as CSSProperties)
          : undefined
      }
      className="calendar-sheet mx-auto w-full max-w-7xl overflow-hidden rounded-sm shadow-[0_30px_70px_rgba(15,23,42,0.18)] md:h-[calc(100vh-2.5rem)] md:max-h-[980px]"
    >
      <div className="calendar-rings" aria-hidden />
      <div className="grid gap-4 p-3 md:h-full md:grid-cols-[240px_minmax(0,1fr)_350px] md:gap-3 md:p-4 lg:grid-cols-[280px_minmax(0,1fr)_380px] lg:gap-4 lg:p-5">
        <div
          className="calendar-hero relative h-72 w-full overflow-hidden rounded-2xl sm:h-80 md:h-full md:min-h-0"
          style={
            {
              "--hero-parallax-x": heroParallax.x.toFixed(3),
              "--hero-parallax-y": heroParallax.y.toFixed(3),
            } as CSSProperties
          }
          onMouseMove={onHeroMouseMove}
          onMouseLeave={onHeroMouseLeave}
        >
          <button
            type="button"
            onClick={() => void onRibbonTap()}
            onAnimationEnd={onRibbonAnimationEnd}
            className={`calendar-refresh-ribbon ${isRibbonStretching ? "is-stretching" : ""}`}
            aria-label="Load a new hero gif"
          >
            <span className="calendar-refresh-ribbon-label">{isLoadingGif ? "..." : "CHANGE"}</span>
          </button>
          {/* Using img intentionally to preserve GIF animation in the hero area. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={heroGif} alt="Animated scenic calendar hero" className="calendar-hero-media h-full w-full object-cover" onLoad={onHeroImageLoad} />
          <div className="calendar-hero-overlay" />
          <div className="calendar-month-stack">
            <p className="calendar-month-stack-year">{viewDate.getFullYear()}</p>
            <div className="calendar-month-stack-letters" aria-label={monthName}>
              {monthName.split("").map((letter, index) => (
                <span key={`${letter}-${index}`}>{letter}</span>
              ))}
            </div>
          </div>
        </div>

        <div className="calendar-panel flex min-h-0 flex-col rounded-2xl p-3 md:col-start-2 md:row-start-1 md:h-full md:p-4">
          <div className="mb-3 shrink-0 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <p className="calendar-muted text-[11px] font-medium tracking-widest">WALL CALENDAR</p>
                <p className="calendar-subtle text-[11px]">Pick theme, then choose month/year and date range.</p>
              </div>
              <div className="calendar-select-wrap shrink-0 pt-0.5">
                <label className="sr-only" htmlFor="wall-calendar-theme">
                  Theme
                </label>
                <select
                  id="wall-calendar-theme"
                  value={theme}
                  onChange={(event) => setTheme(event.target.value as ThemeName)}
                  className="calendar-select"
                >
                  <option value="ocean">Ocean</option>
                  <option value="sunset">Sunset</option>
                  <option value="midnight">Midnight</option>
                </select>
              </div>
            </div>
            <div className="calendar-top-controls flex flex-wrap items-center gap-2">
              {suggestedTheme && suggestedTheme !== theme ? (
                <button type="button" onClick={() => setTheme(suggestedTheme)} className="calendar-chip">
                  Mood: {suggestedTheme}
                </button>
              ) : null}
              {activeAction === "rangeNote" ? (
                <div className="calendar-select-wrap calendar-range-preset-wrap shrink-0">
                  <label className="sr-only" htmlFor="wall-calendar-range-preset">
                    Range preset
                  </label>
                  <select
                    id="wall-calendar-range-preset"
                    defaultValue=""
                    className="calendar-select !py-2 !pl-3 !pr-7 !text-xs"
                    onChange={(event) => {
                      const preset = event.currentTarget.value as "weekend" | "next7" | "month" | "";
                      if (!preset) return;
                      applyPreset(preset);
                      event.currentTarget.value = "";
                    }}
                    aria-label="Select a date range preset"
                  >
                    <option value="" disabled>
                      No range selected
                    </option>
                    <option value="weekend">This Weekend</option>
                    <option value="next7">Next 7 Days</option>
                    <option value="month">This Month</option>
                  </select>
                </div>
              ) : null}
              <button type="button" onClick={clearSelection} className="calendar-link-btn text-xs font-medium">
                Clear
              </button>
              {activeAction !== "holidays" ? (
                <span
                  className="calendar-range-pill ml-auto"
                  aria-label={
                    activeAction === "monthMemo"
                      ? range.start && range.end
                        ? `Memo due date selected ${formatRangeLabel(range.start, range.end)}`
                        : "No date selected for memo"
                      : `Selected range length ${rangeLength} days`
                  }
                >
                  {activeAction === "monthMemo"
                    ? range.start && range.end
                      ? `Due date selected · ${new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(range.start)}`
                      : "No date selected"
                    : rangeLength > 0
                      ? `${rangeLength} day${rangeLength > 1 ? "s" : ""} selected`
                      : "No range selected"}
                </span>
              ) : null}
            </div>
          </div>
          <div className="shrink-0">
            <CalendarGrid
              monthDate={viewDate}
              range={range}
              selectionMode={activeAction === "monthMemo" ? "single" : "range"}
              onSelectDate={onSelectDate}
              monthOptions={monthOptions}
              yearOptions={yearOptions}
              onMonthSelect={onMonthSelect}
              onYearSelect={onYearSelect}
              onMoveMonth={moveMonth}
              onJumpToDate={onJumpToDate}
              onSelectRange={onSelectRange}
              onDoubleClickDate={onDoubleClickDate}
              holidayTierByDate={holidayTierByDate}
              holidayLabelsByDate={holidayLabelsByDate}
              transitionKey={monthTransitionKey}
            />
          </div>
          <div className="mt-3 flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-[color:var(--theme-panel-border)] bg-[color:var(--theme-notes-bg)] p-2.5 md:min-h-[10rem]">
            <div className="mb-2 flex shrink-0 flex-wrap items-center justify-between gap-2">
              <p className="calendar-subtle text-[11px] font-medium uppercase tracking-wide">Activity</p>
              <div className="calendar-select-wrap calendar-activity-scope-wrap shrink-0">
                <label className="sr-only" htmlFor="activity-scope">
                  Activity view
                </label>
                <select
                  id="activity-scope"
                  value={activityScope}
                  onChange={(event) => setActivityScope(event.target.value as ActivityScope)}
                  className="calendar-select !py-1 !pl-2 !pr-6 !text-[10px]"
                  aria-label="Activity view"
                >
                  <option value="ongoing">Ongoing</option>
                  <option value="tomorrow">Tomorrow</option>
                  <option value="7d">7 days</option>
                  <option value="30d">30 days</option>
                </select>
              </div>
            </div>
            {activityDisplayRows.length === 0 ? (
              <p className="calendar-muted shrink-0 text-xs">{activityEmptyLabel}</p>
            ) : (
              <div
                className="calendar-activity-scroll min-h-0 w-full flex-1 basis-0 overflow-y-scroll max-h-[10rem] md:max-h-none"
                aria-label="Activity list"
                role="region"
              >
                <ul className="space-y-1.5 pr-0.5">
                  {activityDisplayRows.map((item) => (
                    <li
                      key={item.id}
                      className="calendar-reminder-row flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-2"
                    >
                      <span className="calendar-text min-w-0 flex-1 text-xs">
                        <span className="calendar-muted text-[10px] font-medium uppercase tracking-wide">{item.detail}</span>{" "}
                        <span className="break-words">{item.primary}</span>
                      </span>
                      <span className="calendar-muted shrink-0 text-[10px] tabular-nums sm:text-right">{item.dateLabel}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <p className="sr-only" aria-live="polite">
            {liveSummary}
          </p>
        </div>
        <div
          className="md:col-start-3 md:row-start-1 md:h-full md:min-h-0 md:overflow-hidden md:pr-1 md:pb-1"
          role="region"
          aria-label="Notes and reminder tools"
          tabIndex={0}
        >
          <NotesPanel
            theme={theme}
            monthLabel={monthLabel}
            rangeLabel={rangeLabel}
            monthNote={monthNote}
            rangeNote={selectedRangeNote}
            activeAction={activeAction}
            holidays={holidaysThisMonth}
            currentYearHolidays={currentYearHolidays}
            onActionChange={setActiveAction}
            onMonthNoteChange={onMonthNoteChange}
            onRangeNoteChange={onRangeNoteChangePatch}
            calendarDueDateKey={calendarDueDateKey}
            savedRangeNotes={savedRangeNotesForMonth}
            onSaveRangeNote={onSaveRangeNote}
            onDeleteSavedRangeNote={onDeleteSavedRangeNote}
            onUpdateSavedRangeNote={onUpdateSavedRangeNote}
            reminderDraft={reminderDraft}
            reminders={remindersForMonth}
            reminderInstances={reminderInstances}
            onReminderDraftChange={onReminderDraftChange}
            onAddRecurringReminder={onAddRecurringReminder}
            onDeleteRecurringReminder={onDeleteRecurringReminder}
          />
        </div>
      </div>
    </section>
  );
}
