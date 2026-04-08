"use client";

import type { DateRange } from "@/components/wall-calendar/types";
import { buildCalendarGrid, formatDateKey, isDateBetween, isWeekend, sameDay } from "@/lib/date";

type CalendarGridProps = {
  monthDate: Date;
  range: DateRange;
  onSelectDate: (date: Date) => void;
  monthOptions: Array<{ value: number; label: string }>;
  yearOptions: number[];
  onMonthSelect: (month: number) => void;
  onYearSelect: (year: number) => void;
  onMoveMonth: (delta: number) => void;
  holidayDateSet: Set<string>;
  transitionKey: string;
};

const weekdayLabels = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

function getDayButtonClass({
  inCurrentMonth,
  isInRange,
  isToday,
  isEdge,
}: {
  inCurrentMonth: boolean;
  isInRange: boolean;
  isToday: boolean;
  isEdge: boolean;
}) {
  return [
    "calendar-day-btn relative flex h-8 w-full items-center justify-center rounded-full text-xs font-medium transition-all duration-150 sm:h-9 sm:text-sm",
    inCurrentMonth ? "calendar-day-current" : "calendar-day-other",
    isInRange ? "calendar-day-in-range" : "",
    isToday ? "calendar-day-today" : "",
    isEdge ? "calendar-day-edge" : "",
  ]
    .join(" ")
    .trim();
}

export function CalendarGrid({
  monthDate,
  range,
  onSelectDate,
  monthOptions,
  yearOptions,
  onMonthSelect,
  onYearSelect,
  onMoveMonth,
  holidayDateSet,
  transitionKey,
}: CalendarGridProps) {
  const days = buildCalendarGrid(monthDate);
  const { start, end } = range;

  return (
    <div className="calendar-grid-shell rounded-2xl px-2 py-3 sm:px-3">
      <div className="mb-3 flex items-center justify-between gap-2">
        <button type="button" onClick={() => onMoveMonth(-1)} className="calendar-arrow-btn" aria-label="Previous month">
          <span aria-hidden>‹</span>
        </button>
        <div className="flex items-center gap-2">
          <div className="calendar-select-wrap">
            <select
              aria-label="Select month"
              value={monthDate.getMonth()}
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
              value={monthDate.getFullYear()}
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
        <button type="button" onClick={() => onMoveMonth(1)} className="calendar-arrow-btn" aria-label="Next month">
          <span aria-hidden>›</span>
        </button>
      </div>

      <div className="calendar-weekdays mb-2 grid grid-cols-7 gap-1 text-center text-[10px] font-semibold tracking-wide sm:gap-2">
        {weekdayLabels.map((label) => (
          <div key={label}>{label}</div>
        ))}
      </div>

      <div key={transitionKey} className="calendar-month-transition grid grid-cols-7 gap-1 sm:gap-2">
        {days.map(({ date, inCurrentMonth, isToday }) => {
          const isStart = !!start && sameDay(date, start);
          const isEnd = !!end && sameDay(date, end);
          const isInRange = !!start && !!end && isDateBetween(date, start, end);
          const context = {
            isWeekend: isWeekend(date),
            isHoliday: holidayDateSet.has(formatDateKey(date)),
          };

          const buttonClasses = getDayButtonClass({
            inCurrentMonth,
            isInRange,
            isToday,
            isEdge: isStart || isEnd,
          });

          return (
            <button
              type="button"
              key={date.toISOString()}
              onClick={() => onSelectDate(date)}
              className={buttonClasses}
              aria-label={`Select ${date.toDateString()}`}
            >
              {date.getDate()}
              <span
                className={`calendar-day-dot ${context.isHoliday ? "holiday" : context.isWeekend ? "weekend" : ""}`}
                aria-hidden
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
