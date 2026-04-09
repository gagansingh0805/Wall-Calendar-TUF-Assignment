"use client";

import { useState } from "react";
import type { DateRange } from "@/components/wall-calendar/types";

export type ThemeName = "ocean" | "sunset" | "midnight";
export type ActivityScope = "ongoing" | "tomorrow" | "7d" | "30d";
export type PanelAction = "monthMemo" | "rangeNote" | "recurring" | "holidays";
export type HeroParallax = { x: number; y: number };

export function useCalendar() {
  const [viewDate, setViewDate] = useState<Date>(new Date());
  const [theme, setTheme] = useState<ThemeName>("midnight");
  const [heroParallax, setHeroParallax] = useState<HeroParallax>({ x: 0, y: 0 });
  const [range, setRange] = useState<DateRange>({ start: null, end: null });
  const [holidaysByYear, setHolidaysByYear] = useState<Record<number, { date: string; name: string }[]>>({});
  const [activeAction, setActiveAction] = useState<PanelAction>("monthMemo");
  const [activityScope, setActivityScope] = useState<ActivityScope>("7d");

  return {
    viewDate,
    setViewDate,
    theme,
    setTheme,
    heroParallax,
    setHeroParallax,
    range,
    setRange,
    holidaysByYear,
    setHolidaysByYear,
    activeAction,
    setActiveAction,
    activityScope,
    setActivityScope,
  };
}
