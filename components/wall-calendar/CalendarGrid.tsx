"use client";

import type { DateRange } from "@/components/wall-calendar/types";
import { buildCalendarGrid, isDateBetween, sameDay } from "@/lib/date";

type CalendarGridProps = {
  monthDate: Date;
  range: DateRange;
  onSelectDate: (date: Date) => void;
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

export function CalendarGrid({ monthDate, range, onSelectDate }: CalendarGridProps) {
  const days = buildCalendarGrid(monthDate);
  const { start, end } = range;

  return (
    <div className="calendar-grid-shell rounded-2xl px-2 py-3 sm:px-3">
      <div className="calendar-weekdays mb-2 grid grid-cols-7 gap-1 text-center text-[10px] font-semibold tracking-wide sm:gap-2">
        {weekdayLabels.map((label) => (
          <div key={label}>{label}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1 sm:gap-2">
        {days.map(({ date, inCurrentMonth, isToday }) => {
          const isStart = !!start && sameDay(date, start);
          const isEnd = !!end && sameDay(date, end);
          const isInRange = !!start && !!end && isDateBetween(date, start, end);

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
            </button>
          );
        })}
      </div>
    </div>
  );
}
