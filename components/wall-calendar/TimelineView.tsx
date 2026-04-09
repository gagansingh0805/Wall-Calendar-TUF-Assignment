"use client";

type TimelineItem = {
  id: string;
  title: string;
  label: string;
};

type TimelineViewProps = {
  items: TimelineItem[];
};

export function TimelineView({ items }: TimelineViewProps) {
  return (
    <div className="calendar-mini-sheet">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="calendar-subtle text-[11px] font-medium uppercase tracking-wide">Timeline</p>
        <span className="calendar-muted text-[10px]">Upcoming</span>
      </div>
      {items.length === 0 ? (
        <p className="calendar-muted text-xs">No upcoming timeline entries.</p>
      ) : (
        <ol className="space-y-1.5">
          {items.slice(0, 6).map((item) => (
            <li key={item.id} className="calendar-reminder-row">
              <span className="calendar-text text-xs">{item.title}</span>
              <span className="calendar-muted text-[10px]">{item.label}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
