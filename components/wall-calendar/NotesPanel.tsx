"use client";

import { useEffect, useRef, type RefObject } from "react";
import type { RecurrenceFreq, RecurringReminderRule, WeekdayCode } from "@/components/wall-calendar/types";

type NotesPanelProps = {
  monthLabel: string;
  rangeLabel: string;
  monthNote: string;
  rangeNote: string;
  holidays: Array<{ date: Date; label: string; tier: "major" | "minor" }>;
  currentYearHolidays: Array<{ date: Date; label: string; tier: "major" | "minor" }>;
  onMonthNoteChange: (value: string) => void;
  onRangeNoteChange: (value: string) => void;
  reminderDraft: {
    text: string;
    freq: RecurrenceFreq;
    interval: number;
    byMonthDay: string;
    byWeekday: WeekdayCode[];
    count: string;
    until: string;
  };
  reminders: RecurringReminderRule[];
  reminderInstances: Array<{ id: string; text: string; date: Date }>;
  onReminderDraftChange: (patch: Partial<NotesPanelProps["reminderDraft"]>) => void;
  onAddRecurringReminder: () => void;
  onDeleteRecurringReminder: (id: string) => void;
  focusRangeNoteSignal?: number;
};

type NoteFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  minHeightClass: string;
  textAreaRef?: RefObject<HTMLTextAreaElement | null>;
};

function NoteField({ label, value, onChange, placeholder, minHeightClass, textAreaRef }: NoteFieldProps) {
  return (
    <label className="flex flex-col gap-2">
      <span className="calendar-subtle text-[11px] font-medium uppercase tracking-wide">{label}</span>
      <textarea
        ref={textAreaRef}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={`calendar-notes-area ${minHeightClass}`}
      />
    </label>
  );
}

export function NotesPanel({
  monthLabel,
  rangeLabel,
  monthNote,
  rangeNote,
  holidays,
  currentYearHolidays,
  onMonthNoteChange,
  onRangeNoteChange,
  reminderDraft,
  reminders,
  reminderInstances,
  onReminderDraftChange,
  onAddRecurringReminder,
  onDeleteRecurringReminder,
  focusRangeNoteSignal = 0,
}: NotesPanelProps) {
  const rangeNoteRef = useRef<HTMLTextAreaElement | null>(null);
  const isWeekly = reminderDraft.freq === "weekly";
  const isMonthly = reminderDraft.freq === "monthly";

  useEffect(() => {
    if (!focusRangeNoteSignal) return;
    rangeNoteRef.current?.focus();
  }, [focusRangeNoteSignal]);

  return (
    <aside className="calendar-panel flex h-full flex-col gap-4 rounded-2xl p-3 sm:p-4">
      <div>
        <h3 className="calendar-muted text-[11px] font-semibold tracking-wide">Notes</h3>
        <p className="calendar-muted mt-1 text-xs">{monthLabel}</p>
      </div>

      <NoteField
        label="Month memo"
        value={monthNote}
        onChange={onMonthNoteChange}
        placeholder="Write reminders for this month..."
        minHeightClass="min-h-24"
      />

      <NoteField
        label={`Range (${rangeLabel})`}
        value={rangeNote}
        onChange={onRangeNoteChange}
        placeholder="Optional note for the selected date range..."
        minHeightClass="min-h-20"
        textAreaRef={rangeNoteRef}
      />

      <div className="rounded-xl border border-[color:var(--theme-panel-border)] bg-[color:var(--theme-notes-bg)] p-2.5">
        <div className="flex items-center justify-between gap-2">
          <p className="calendar-subtle text-[11px] font-medium uppercase tracking-wide">Recurring reminders</p>
          <span className="calendar-muted text-[10px]">Rule builder</span>
        </div>
        <div className="mt-2 grid gap-2.5">
          <label className="calendar-field-label">
            Reminder
            <input
              value={reminderDraft.text}
              onChange={(event) => onReminderDraftChange({ text: event.target.value })}
              placeholder="Ex: Pay electricity bill"
              className="calendar-reminder-input"
              aria-label="Reminder text"
            />
          </label>

          <div className="grid grid-cols-[1fr_auto] gap-2">
            <label className="calendar-field-label">
              Frequency
              <select
                aria-label="Recurrence frequency"
                value={reminderDraft.freq}
                onChange={(event) => onReminderDraftChange({ freq: event.target.value as RecurrenceFreq })}
                className="calendar-reminder-input"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </label>
            <label className="calendar-field-label">
              Every
              <input
                value={reminderDraft.interval}
                onChange={(event) => onReminderDraftChange({ interval: Math.max(1, Number(event.target.value) || 1) })}
                type="number"
                min={1}
                className="calendar-reminder-input w-20"
                aria-label="Interval"
              />
            </label>
          </div>

          {isMonthly ? (
            <label className="calendar-field-label">
              Month days
              <input
                value={reminderDraft.byMonthDay}
                onChange={(event) => onReminderDraftChange({ byMonthDay: event.target.value })}
                placeholder="12 or 12,28"
                className="calendar-reminder-input"
                aria-label="Monthly days"
              />
            </label>
          ) : null}

          {isWeekly ? (
            <div>
              <p className="calendar-field-label mb-1">Weekdays</p>
              <div className="flex flex-wrap gap-1.5">
                {(["SU", "MO", "TU", "WE", "TH", "FR", "SA"] as WeekdayCode[]).map((day) => {
                  const active = reminderDraft.byWeekday.includes(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      className={`calendar-chip ${active ? "calendar-chip-active" : ""}`}
                      onClick={() =>
                        onReminderDraftChange({
                          byWeekday: active ? reminderDraft.byWeekday.filter((item) => item !== day) : [...reminderDraft.byWeekday, day],
                        })
                      }
                      aria-pressed={active}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-2">
            <label className="calendar-field-label">
              Ends on
              <input
                value={reminderDraft.until}
                onChange={(event) => onReminderDraftChange({ until: event.target.value })}
                type="date"
                className="calendar-reminder-input"
                aria-label="Until date"
              />
            </label>
            <label className="calendar-field-label">
              Or after count
              <input
                value={reminderDraft.count}
                onChange={(event) => onReminderDraftChange({ count: event.target.value })}
                placeholder="Optional"
                className="calendar-reminder-input"
                aria-label="Repeat count"
              />
            </label>
          </div>

          <button type="button" className="calendar-reminder-add-btn" onClick={onAddRecurringReminder}>
            Add recurring
          </button>
        </div>
        {reminders.length > 0 ? (
          <ul className="mt-3 space-y-1.5">
            {reminders.map((reminder) => (
              <li key={reminder.id} className="calendar-reminder-row">
                <span className="calendar-text text-xs">{reminder.text}</span>
                <button type="button" className="calendar-link-btn text-xs" onClick={() => onDeleteRecurringReminder(reminder.id)}>
                  Remove
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        {reminderInstances.length > 0 ? (
          <ul className="mt-3 space-y-1.5">
            {reminderInstances.slice(0, 6).map((item) => (
              <li key={`${item.id}-${item.date.toISOString()}`} className="calendar-reminder-instance">
                {new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(item.date)} - {item.text}
              </li>
            ))}
          </ul>
        ) : (
          <p className="calendar-muted mt-2 text-xs">No reminder occurrences for this month.</p>
        )}
      </div>

      <div className="rounded-xl border border-[color:var(--theme-panel-border)] bg-[color:var(--theme-notes-bg)] p-2.5">
        <p className="calendar-subtle text-[11px] font-medium uppercase tracking-wide">Holidays this month</p>
        {holidays.length === 0 ? (
          <p className="calendar-muted mt-2 text-xs">No holidays this month</p>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {holidays.map((holiday) => (
              <li key={`${holiday.label}-${holiday.date.toISOString()}`} className={`calendar-holiday-item ${holiday.tier} calendar-text text-xs`}>
                {new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(holiday.date)} - {holiday.label}
              </li>
            ))}
          </ul>
        )}
      </div>

      <details className="rounded-xl border border-[color:var(--theme-panel-border)] bg-[color:var(--theme-notes-bg)] p-2.5">
        <summary className="calendar-subtle cursor-pointer text-[11px] font-medium uppercase tracking-wide">
          This year&apos;s Indian holidays
        </summary>
        {currentYearHolidays.length === 0 ? (
          <p className="calendar-muted mt-2 text-xs">No holidays found for this year</p>
        ) : (
          <ul className="mt-2 max-h-40 space-y-1.5 overflow-auto pr-1">
            {currentYearHolidays.map((holiday) => (
              <li key={`${holiday.label}-${holiday.date.toISOString()}`} className={`calendar-holiday-item ${holiday.tier} calendar-text text-xs`}>
                {new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(holiday.date)} - {holiday.label}
              </li>
            ))}
          </ul>
        )}
      </details>
    </aside>
  );
}
