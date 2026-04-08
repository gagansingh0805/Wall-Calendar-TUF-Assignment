"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import type { DateRange } from "@/components/wall-calendar/types";
import { addDays, addMonths, buildCalendarGrid, formatDateKey, getWeekEnd, getWeekStart, isDateBetween, isWeekend, sameDay, startOfDay } from "@/lib/date";

type CalendarGridProps = {
  monthDate: Date;
  range: DateRange;
  onSelectDate: (date: Date) => void;
  monthOptions: Array<{ value: number; label: string }>;
  yearOptions: number[];
  onMonthSelect: (month: number) => void;
  onYearSelect: (year: number) => void;
  onMoveMonth: (delta: number) => void;
  onJumpToDate: (date: Date) => void;
  onSelectRange: (start: Date, end: Date) => void;
  onDoubleClickDate: (date: Date) => void;
  holidayTierByDate: Record<string, "major" | "minor">;
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
  onJumpToDate,
  onSelectRange,
  onDoubleClickDate,
  holidayTierByDate,
  transitionKey,
}: CalendarGridProps) {
  const days = useMemo(() => buildCalendarGrid(monthDate), [monthDate]);
  const { start, end } = range;
  const [focusedDate, setFocusedDate] = useState<Date>(start ?? startOfDay(new Date()));
  const [dragAnchor, setDragAnchor] = useState<Date | null>(null);
  const [dragCurrent, setDragCurrent] = useState<Date | null>(null);
  const [dragMoved, setDragMoved] = useState<boolean>(false);
  const dayRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  useEffect(() => {
    if (start) {
      setFocusedDate((previous) => (sameDay(previous, start) ? previous : start));
      return;
    }
    const nextFocus = days.find((day) => day.isToday)?.date ?? days[0]?.date;
    if (!nextFocus) return;
    setFocusedDate((previous) => (sameDay(previous, nextFocus) ? previous : nextFocus));
  }, [days, start]);

  useEffect(() => {
    const key = formatDateKey(focusedDate);
    dayRefs.current[key]?.focus();
  }, [focusedDate, monthDate]);

  const previewRange = useMemo(() => {
    if (!dragAnchor || !dragCurrent) return null;
    const [previewStart, previewEnd] = dragAnchor.getTime() <= dragCurrent.getTime() ? [dragAnchor, dragCurrent] : [dragCurrent, dragAnchor];
    return { start: previewStart, end: previewEnd };
  }, [dragAnchor, dragCurrent]);

  function handlePointerDown(date: Date) {
    setDragAnchor(date);
    setDragCurrent(date);
    setDragMoved(false);
  }

  function handlePointerEnter(date: Date) {
    if (!dragAnchor) return;
    if (!sameDay(date, dragAnchor)) {
      setDragMoved(true);
    }
    setDragCurrent(date);
  }

  function handlePointerUp(date: Date) {
    if (!dragAnchor) return;
    if (dragMoved) {
      onSelectRange(dragAnchor, date);
    }
    setDragAnchor(null);
    setDragCurrent(null);
    setDragMoved(false);
  }

  function moveFocusedDate(nextDate: Date) {
    const next = startOfDay(nextDate);
    if (next.getMonth() !== monthDate.getMonth() || next.getFullYear() !== monthDate.getFullYear()) {
      onJumpToDate(next);
    }
    setFocusedDate(next);
  }

  function onDayKeyDown(event: KeyboardEvent<HTMLButtonElement>, date: Date) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelectDate(date);
      return;
    }

    const key = event.key;
    if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End", "PageUp", "PageDown"].includes(key)) return;
    event.preventDefault();
    if (key === "ArrowUp") moveFocusedDate(addDays(date, -7));
    if (key === "ArrowDown") moveFocusedDate(addDays(date, 7));
    if (key === "ArrowLeft") moveFocusedDate(addDays(date, -1));
    if (key === "ArrowRight") moveFocusedDate(addDays(date, 1));
    if (key === "Home") moveFocusedDate(getWeekStart(date));
    if (key === "End") moveFocusedDate(getWeekEnd(date));
    if (key === "PageUp") moveFocusedDate(addMonths(date, -1));
    if (key === "PageDown") moveFocusedDate(addMonths(date, 1));
  }

  return (
    <div className="calendar-grid-shell rounded-2xl px-2 py-3 sm:px-3" role="region" aria-label="Date picker calendar">
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

      <div className="calendar-weekdays mb-2 grid grid-cols-7 gap-1 text-center text-[10px] font-semibold tracking-wide sm:gap-2" role="row">
        {weekdayLabels.map((label) => (
          <div key={label} role="columnheader" aria-label={label}>
            {label}
          </div>
        ))}
      </div>

      <div key={transitionKey} className="calendar-month-transition grid grid-cols-7 gap-1 sm:gap-2" role="grid" aria-label="Calendar dates">
        {days.map(({ date, inCurrentMonth, isToday }) => {
          const isStart = !!start && sameDay(date, start);
          const isEnd = !!end && sameDay(date, end);
          const effectiveStart = previewRange?.start ?? start;
          const effectiveEnd = previewRange?.end ?? end;
          const isInRange = !!effectiveStart && !!effectiveEnd && isDateBetween(date, effectiveStart, effectiveEnd);
          const context = {
            isWeekend: isWeekend(date),
            holidayTier: holidayTierByDate[formatDateKey(date)] ?? null,
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
              onPointerDown={() => handlePointerDown(date)}
              onPointerEnter={() => handlePointerEnter(date)}
              onPointerUp={() => handlePointerUp(date)}
              onPointerCancel={() => {
                setDragAnchor(null);
                setDragCurrent(null);
                setDragMoved(false);
              }}
              onDoubleClick={() => onDoubleClickDate(date)}
              onKeyDown={(event) => onDayKeyDown(event, date)}
              ref={(node) => {
                dayRefs.current[formatDateKey(date)] = node;
              }}
              className={buttonClasses}
              tabIndex={sameDay(date, focusedDate) ? 0 : -1}
              role="gridcell"
              aria-selected={isInRange || isStart || isEnd}
              aria-current={isToday ? "date" : undefined}
              aria-label={`Select ${date.toDateString()}`}
            >
              {date.getDate()}
              <span
                className={`calendar-day-dot ${
                  context.holidayTier ? `holiday ${context.holidayTier}` : context.isWeekend ? "weekend" : ""
                }`}
                aria-hidden
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
