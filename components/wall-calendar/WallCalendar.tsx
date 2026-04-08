"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties, type MouseEvent, type SyntheticEvent } from "react";
import { CalendarGrid } from "@/components/wall-calendar/CalendarGrid";
import { NotesPanel } from "@/components/wall-calendar/NotesPanel";
import type { DateRange, RangeBadge, RecurringReminderRule, StoredNoteMap, StoredRangeBadgeMap, StoredRecurringReminderMap, WeekdayCode } from "@/components/wall-calendar/types";
import {
  formatDateKey,
  formatMonth,
  formatRangeLabel,
  getNext7DaysRange,
  getRangeLengthDays,
  getThisMonthRange,
  getThisWeekendRange,
  isDateBetween,
  monthKey,
  normalizeRange,
  rangeKey,
  sameDay,
  startOfDay,
  toLocalDateKey,
} from "@/lib/date";

const MONTH_NOTES_STORAGE_KEY = "wall-calendar-month-notes";
const RANGE_NOTES_STORAGE_KEY = "wall-calendar-range-notes";
const RANGE_BADGES_STORAGE_KEY = "wall-calendar-range-badges";
const RECURRING_REMINDERS_STORAGE_KEY = "wall-calendar-recurring-reminders";
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
  const [focusRangeNoteSignal, setFocusRangeNoteSignal] = useState(0);
  const [dynamicAccent, setDynamicAccent] = useState<DynamicAccent>(null);
  const [suggestedTheme, setSuggestedTheme] = useState<ThemeName | null>(null);
  const [heroParallax, setHeroParallax] = useState<HeroParallax>({ x: 0, y: 0 });
  const [range, setRange] = useState<DateRange>({ start: null, end: null });
  const [holidaysByYear, setHolidaysByYear] = useState<Record<number, HolidayRecord[]>>({});
  const [monthNotes, setMonthNotes] = useStoredMap(MONTH_NOTES_STORAGE_KEY);
  const [rangeNotes, setRangeNotes] = useStoredMap(RANGE_NOTES_STORAGE_KEY);
  const [rangeBadges, setRangeBadges] = useStoredObject<StoredRangeBadgeMap>(RANGE_BADGES_STORAGE_KEY, {});
  const [recurringReminders, setRecurringReminders] = useStoredObject<StoredRecurringReminderMap>(RECURRING_REMINDERS_STORAGE_KEY, {});
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

  const monthId = monthKey(viewDate);
  const rangeId = rangeKey(range.start, range.end);
  const monthNote = monthNotes[monthId] ?? "";
  const selectedRangeNote = rangeNotes[`${monthId}_${rangeId}`] ?? "";
  const currentRangeBadge = rangeBadges[rangeId] ?? null;

  const monthLabel = useMemo(() => formatMonth(viewDate), [viewDate]);
  const monthName = useMemo(
    () => new Intl.DateTimeFormat("en-US", { month: "long" }).format(viewDate).toUpperCase(),
    [viewDate],
  );
  const rangeLabel = useMemo(() => formatRangeLabel(range.start, range.end), [range.start, range.end]);
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
  const monthTransitionKey = useMemo(() => monthKey(viewDate), [viewDate]);
  const remindersForMonth = recurringReminders[monthId] ?? [];
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
    const [start, end] =
      preset === "weekend" ? getThisWeekendRange(viewDate) : preset === "next7" ? getNext7DaysRange(viewDate) : getThisMonthRange(viewDate);
    if (range.start && range.end && sameDay(range.start, start) && sameDay(range.end, end)) {
      clearSelection();
      return;
    }
    onSelectRange(start, end);
  }

  function onRangeBadgeChange(value: string) {
    if (!range.start || !range.end) return;
    setRangeBadges((prev) => {
      const key = rangeKey(range.start, range.end);
      const current = prev[key] ?? { kind: "Trip", label: "Trip", source: "auto" as const };
      return { ...prev, [key]: { ...current, label: value, source: "manual" } };
    });
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

  function onRangeNoteChange(value: string) {
    setRangeNotes((prev) => ({ ...prev, [`${monthId}_${rangeId}`]: value }));
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
      className="calendar-sheet mx-auto w-full max-w-6xl overflow-hidden rounded-sm shadow-[0_30px_70px_rgba(15,23,42,0.18)]"
    >
      <div className="calendar-rings" aria-hidden />
      <div
        className="calendar-hero relative h-72 w-full sm:h-80"
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
          {isLoadingGif ? "..." : "NEW"}
        </button>
        {/* Using img intentionally to preserve GIF animation in the hero area. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={heroGif} alt="Animated scenic calendar hero" className="calendar-hero-media h-full w-full object-cover" onLoad={onHeroImageLoad} />
        <div className="calendar-hero-cut-left" />
        <div className="calendar-hero-cut-right" />
        <div className="calendar-hero-overlay" />
        <div className="calendar-month-badge">
          <p className="text-5xl font-semibold leading-none tracking-tight text-white sm:text-6xl">{viewDate.getFullYear()}</p>
          <p className="text-3xl font-extrabold leading-none text-white sm:text-5xl">{monthName}</p>
        </div>
      </div>

      <div className="grid gap-4 p-3 lg:grid-cols-[1.1fr_1.65fr] sm:p-5">
        <NotesPanel
          monthLabel={monthLabel}
          rangeLabel={rangeLabel}
          monthNote={monthNote}
          rangeNote={selectedRangeNote}
          holidays={holidaysThisMonth}
          currentYearHolidays={currentYearHolidays}
          onMonthNoteChange={onMonthNoteChange}
          onRangeNoteChange={onRangeNoteChange}
          reminderDraft={reminderDraft}
          reminders={remindersForMonth}
          reminderInstances={reminderInstances}
          onReminderDraftChange={onReminderDraftChange}
          onAddRecurringReminder={onAddRecurringReminder}
          onDeleteRecurringReminder={onDeleteRecurringReminder}
          focusRangeNoteSignal={focusRangeNoteSignal}
        />

        <div className="calendar-panel rounded-2xl p-3 sm:p-4">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
            <div className="space-y-1">
              <p className="calendar-muted text-[11px] font-medium tracking-widest">WALL CALENDAR</p>
              <p className="calendar-subtle text-[11px]">Pick theme, then choose month/year and date range.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {suggestedTheme && suggestedTheme !== theme ? (
                <button type="button" onClick={() => setTheme(suggestedTheme)} className="calendar-chip">
                  Mood: {suggestedTheme}
                </button>
              ) : null}
              <button type="button" onClick={() => applyPreset("weekend")} className="calendar-chip" aria-label="Select this weekend range">
                This Weekend
              </button>
              <button type="button" onClick={() => applyPreset("next7")} className="calendar-chip" aria-label="Select next 7 days range">
                Next 7 Days
              </button>
              <button type="button" onClick={() => applyPreset("month")} className="calendar-chip" aria-label="Select this month range">
                This Month
              </button>
              <div className="calendar-select-wrap">
                <select
                  aria-label="Select theme"
                  value={theme}
                  onChange={(event) => setTheme(event.target.value as ThemeName)}
                  className="calendar-select"
                >
                  <option value="ocean">Ocean</option>
                  <option value="sunset">Sunset</option>
                  <option value="midnight">Midnight</option>
                </select>
              </div>
              <button type="button" onClick={clearSelection} className="calendar-link-btn text-xs font-medium">
                Clear
              </button>
            </div>
          </div>
          <CalendarGrid
            monthDate={viewDate}
            range={range}
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
            transitionKey={monthTransitionKey}
          />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <span className="calendar-range-pill" aria-label={`Selected range length ${rangeLength} days`}>
              {rangeLength > 0 ? `${rangeLength} day${rangeLength > 1 ? "s" : ""} selected` : "No range selected"}
            </span>
            {range.start && range.end ? (
              <label className="calendar-subtle flex items-center gap-2 text-xs">
                Range badge
                <input
                  value={currentRangeBadge?.label ?? ""}
                  onChange={(event) => onRangeBadgeChange(event.target.value)}
                  className="calendar-reminder-input !w-28"
                  aria-label="Edit selected range badge"
                />
              </label>
            ) : null}
            <button type="button" className="calendar-link-btn text-xs font-medium" onClick={() => setFocusRangeNoteSignal((v) => v + 1)}>
              Add note to range
            </button>
          </div>
          <p className="sr-only" aria-live="polite">
            {liveSummary}
          </p>
        </div>
      </div>
    </section>
  );
}
