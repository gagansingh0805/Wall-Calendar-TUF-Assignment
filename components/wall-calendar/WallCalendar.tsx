"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties, type SyntheticEvent } from "react";
import { CalendarGrid } from "@/components/wall-calendar/CalendarGrid";
import { NotesPanel } from "@/components/wall-calendar/NotesPanel";
import type { DateRange, StoredNoteMap } from "@/components/wall-calendar/types";
import { formatDateKey, formatMonth, formatRangeLabel, getRangeLengthDays, monthKey, normalizeRange, rangeKey } from "@/lib/date";

const MONTH_NOTES_STORAGE_KEY = "wall-calendar-month-notes";
const RANGE_NOTES_STORAGE_KEY = "wall-calendar-range-notes";
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

export function WallCalendar() {
  const [viewDate, setViewDate] = useState<Date>(new Date());
  const [theme, setTheme] = useState<ThemeName>("midnight");
  const [focusRangeNoteSignal, setFocusRangeNoteSignal] = useState(0);
  const [dynamicAccent, setDynamicAccent] = useState<DynamicAccent>(null);
  const [range, setRange] = useState<DateRange>({ start: null, end: null });
  const [holidaysByYear, setHolidaysByYear] = useState<Record<number, HolidayRecord[]>>({});
  const [monthNotes, setMonthNotes] = useStoredMap(MONTH_NOTES_STORAGE_KEY);
  const [rangeNotes, setRangeNotes] = useStoredMap(RANGE_NOTES_STORAGE_KEY);
  const { heroGif, isLoadingGif, isRibbonStretching, onRibbonTap, onRibbonAnimationEnd } = useHeroGifLoader();
  useTheme(theme);

  const monthId = monthKey(viewDate);
  const rangeId = rangeKey(range.start, range.end);
  const monthNote = monthNotes[monthId] ?? "";
  const selectedRangeNote = rangeNotes[`${monthId}_${rangeId}`] ?? "";

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
      .map((holiday) => ({ date: new Date(holiday.date), label: holiday.name }))
      .filter((holiday) => holiday.date.getMonth() === month)
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [holidaysByYear, viewDate]);
  const currentYearHolidays = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const yearHolidays = holidaysByYear[currentYear] ?? [];
    return yearHolidays
      .map((holiday) => ({ date: new Date(holiday.date), label: holiday.name }))
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [holidaysByYear]);
  const holidayDateSet = useMemo(
    () => new Set(holidaysThisMonth.map((holiday) => formatDateKey(holiday.date))),
    [holidaysThisMonth],
  );
  const monthTransitionKey = useMemo(() => monthKey(viewDate), [viewDate]);
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
    if (!range.start || (range.start && range.end)) {
      setRange({ start: date, end: null });
      return;
    }

    const [start, end] = normalizeRange(range.start, date);
    setRange({ start, end });
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
    } catch {
      setDynamicAccent(null);
    }
  }

  return (
    <section
      data-theme={theme}
      style={
        dynamicAccent
          ? ({ "--theme-accent": dynamicAccent.accent, "--theme-accent-deep": dynamicAccent.deepAccent } as CSSProperties)
          : undefined
      }
      className="calendar-sheet mx-auto w-full max-w-4xl overflow-hidden rounded-sm shadow-[0_30px_70px_rgba(15,23,42,0.18)]"
    >
      <div className="calendar-rings" aria-hidden />
      <div className="relative h-72 w-full sm:h-80">
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
        <img src={heroGif} alt="Animated scenic calendar hero" className="h-full w-full object-cover" onLoad={onHeroImageLoad} />
        <div className="calendar-hero-cut-left" />
        <div className="calendar-hero-cut-right" />
        <div className="calendar-hero-overlay" />
        <div className="calendar-month-badge">
          <p className="text-5xl font-semibold leading-none tracking-tight text-white sm:text-6xl">{viewDate.getFullYear()}</p>
          <p className="text-3xl font-extrabold leading-none text-white sm:text-5xl">{monthName}</p>
        </div>
      </div>

      <div className="grid gap-4 p-3 sm:grid-cols-[1fr_1.6fr] sm:p-5">
        <NotesPanel
          monthLabel={monthLabel}
          rangeLabel={rangeLabel}
          monthNote={monthNote}
          rangeNote={selectedRangeNote}
          holidays={holidaysThisMonth}
          currentYearHolidays={currentYearHolidays}
          onMonthNoteChange={onMonthNoteChange}
          onRangeNoteChange={onRangeNoteChange}
          focusRangeNoteSignal={focusRangeNoteSignal}
        />

        <div className="calendar-panel rounded-2xl p-3 sm:p-4">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
            <div className="space-y-1">
              <p className="calendar-muted text-[11px] font-medium tracking-widest">WALL CALENDAR</p>
              <p className="calendar-subtle text-[11px]">Pick theme, then choose month/year and date range.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
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
            holidayDateSet={holidayDateSet}
            transitionKey={monthTransitionKey}
          />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <span className="calendar-range-pill">
              {rangeLength > 0 ? `${rangeLength} day${rangeLength > 1 ? "s" : ""} selected` : "No range selected"}
            </span>
            <button type="button" className="calendar-link-btn text-xs font-medium" onClick={() => setFocusRangeNoteSignal((v) => v + 1)}>
              Add note to range
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
