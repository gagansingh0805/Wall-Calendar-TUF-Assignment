export type DateRange = {
  start: Date | null;
  end: Date | null;
};

export type StoredNoteMap = Record<string, string>;

export type DayCell = {
  date: Date;
  inCurrentMonth: boolean;
  isToday: boolean;
};

export type DayContext = {
  isWeekend: boolean;
  isHoliday: boolean;
};
