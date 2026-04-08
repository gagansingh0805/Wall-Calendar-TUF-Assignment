"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarGrid } from "@/components/wall-calendar/CalendarGrid";
import { NotesPanel } from "@/components/wall-calendar/NotesPanel";
import type { DateRange, StoredNoteMap } from "@/components/wall-calendar/types";
import { formatMonth, formatRangeLabel, monthKey, normalizeRange, rangeKey } from "@/lib/date";

const MONTH_NOTES_STORAGE_KEY = "wall-calendar-month-notes";
const RANGE_NOTES_STORAGE_KEY = "wall-calendar-range-notes";
const FALLBACK_GIFS = [
  "https://media.giphy.com/media/3o7TKtnuHOHHUjR38Y/giphy.gif",
  "https://media.giphy.com/media/l0HlBO7eyXzSZkJri/giphy.gif",
];
type ThemeName = "ocean" | "sunset" | "midnight";

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

export function WallCalendar() {
  const [viewDate, setViewDate] = useState<Date>(new Date());
  const [theme, setTheme] = useState<ThemeName>("midnight");
  const [range, setRange] = useState<DateRange>({ start: null, end: null });
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

  return (
    <section
      data-theme={theme}
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
        <img src={heroGif} alt="Animated scenic calendar hero" className="h-full w-full object-cover" />
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
          onMonthNoteChange={onMonthNoteChange}
          onRangeNoteChange={onRangeNoteChange}
        />

        <div className="calendar-panel rounded-2xl p-3 sm:p-4">
          <div className="mb-4 space-y-3">
            <div>
              <p className="calendar-muted text-[11px] font-medium tracking-widest">WALL CALENDAR</p>
              <p className="calendar-subtle mt-1 text-[11px]">Select your month, theme, and date range.</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <div className="calendar-select-wrap">
                  <select
                    aria-label="Select month"
                    value={viewDate.getMonth()}
                    onChange={(event) => onMonthSelect(Number(event.target.value))}
                    className="calendar-select"
                  >
                    {monthOptions.map((month) => (
                      <option key={month.value} value={month.value}>
                        {month.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="calendar-select-wrap">
                  <select
                    aria-label="Select year"
                    value={viewDate.getFullYear()}
                    onChange={(event) => onYearSelect(Number(event.target.value))}
                    className="calendar-select"
                  >
                    {yearOptions.map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
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
            </div>
          </div>

          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => moveMonth(-1)}
                className="calendar-arrow-btn"
                aria-label="Previous month"
              >
                <span aria-hidden>‹</span>
              </button>
              <p className="calendar-text text-sm font-medium">{monthLabel}</p>
              <button
                type="button"
                onClick={() => moveMonth(1)}
                className="calendar-arrow-btn"
                aria-label="Next month"
              >
                <span aria-hidden>›</span>
              </button>
            </div>
            <button type="button" onClick={clearSelection} className="calendar-link-btn text-xs font-medium">
              Clear
            </button>
          </div>
          <CalendarGrid monthDate={viewDate} range={range} onSelectDate={onSelectDate} />
        </div>
      </div>
    </section>
  );
}
