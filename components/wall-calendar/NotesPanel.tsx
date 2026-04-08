"use client";

type NotesPanelProps = {
  monthLabel: string;
  rangeLabel: string;
  monthNote: string;
  rangeNote: string;
  onMonthNoteChange: (value: string) => void;
  onRangeNoteChange: (value: string) => void;
};

type NoteFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  minHeightClass: string;
};

function NoteField({ label, value, onChange, placeholder, minHeightClass }: NoteFieldProps) {
  return (
    <label className="flex flex-col gap-2">
      <span className="calendar-subtle text-[11px] font-medium uppercase tracking-wide">{label}</span>
      <textarea
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
  onMonthNoteChange,
  onRangeNoteChange,
}: NotesPanelProps) {
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
      />
    </aside>
  );
}
