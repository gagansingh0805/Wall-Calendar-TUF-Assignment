export type DateRange = {
  start: Date | null;
  end: Date | null;
};

export type StoredNoteMap = Record<string, string>;

export type RangeBadgeKind = "Trip" | "Exam" | "Sprint";

export type RangeBadge = {
  label: string;
  kind: RangeBadgeKind;
  source: "auto" | "manual";
};

export type StoredRangeBadgeMap = Record<string, RangeBadge>;

export type RecurrenceFreq = "daily" | "weekly" | "monthly";

export type WeekdayCode = "SU" | "MO" | "TU" | "WE" | "TH" | "FR" | "SA";

export type RecurringReminderRule = {
  id: string;
  text: string;
  freq: RecurrenceFreq;
  interval: number;
  byMonthDay?: number[];
  byWeekday?: WeekdayCode[];
  count?: number;
  until?: string;
  startDate: string;
};

export type StoredRecurringReminderMap = Record<string, RecurringReminderRule[]>;

export type DayCell = {
  date: Date;
  inCurrentMonth: boolean;
  isToday: boolean;
};
