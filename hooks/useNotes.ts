"use client";

import { useEffect, useState } from "react";
import type {
  StoredNoteMap,
  StoredRangeBadgeMap,
  StoredRangeNoteMap,
  StoredSavedRangeNotesMap,
  StoredRecurringReminderMap,
  WeekdayCode,
} from "@/components/wall-calendar/types";

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

export function useNotes(storageKeys: {
  monthNotes: string;
  rangeNotes: string;
  savedRangeNotes: string;
  rangeBadges: string;
  recurringReminders: string;
}) {
  const [monthNotes, setMonthNotes] = useStoredMap(storageKeys.monthNotes);
  const [rangeNotes, setRangeNotes] = useStoredObject<StoredRangeNoteMap>(storageKeys.rangeNotes, {});
  const [savedRangeNotesByMonth, setSavedRangeNotesByMonth] = useStoredObject<StoredSavedRangeNotesMap>(
    storageKeys.savedRangeNotes,
    {},
  );
  const [, setRangeBadges] = useStoredObject<StoredRangeBadgeMap>(storageKeys.rangeBadges, {});
  const [recurringReminders, setRecurringReminders] = useStoredObject<StoredRecurringReminderMap>(
    storageKeys.recurringReminders,
    {},
  );
  const [reminderDraft, setReminderDraft] = useState<ReminderDraft>({
    text: "",
    freq: "monthly",
    interval: 1,
    byMonthDay: "",
    byWeekday: [],
    count: "",
    until: "",
  });

  return {
    monthNotes,
    setMonthNotes,
    rangeNotes,
    setRangeNotes,
    savedRangeNotesByMonth,
    setSavedRangeNotesByMonth,
    setRangeBadges,
    recurringReminders,
    setRecurringReminders,
    reminderDraft,
    setReminderDraft,
  };
}

export type { ReminderDraft };
