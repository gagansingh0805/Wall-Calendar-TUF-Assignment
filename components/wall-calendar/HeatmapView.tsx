"use client";

type HeatmapViewProps = {
  points: Array<{ dateKey: string; count: number }>;
};

export function HeatmapView({ points }: HeatmapViewProps) {
  return (
    <div className="calendar-mini-sheet">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="calendar-subtle text-[11px] font-medium uppercase tracking-wide">Heatmap</p>
        <span className="calendar-muted text-[10px]">Activity density</span>
      </div>
      {points.length === 0 ? (
        <p className="calendar-muted text-xs">No data yet. Add notes to build your streak.</p>
      ) : (
        <div className="grid grid-cols-7 gap-1">
          {points.slice(0, 28).map((point) => (
            <div
              key={point.dateKey}
              className="h-4 rounded-sm border border-[color:var(--theme-panel-border)]"
              style={{
                background: `color-mix(in srgb, var(--theme-accent) ${Math.min(82, 14 + point.count * 16)}%, transparent)`,
              }}
              title={`${point.dateKey}: ${point.count} item${point.count === 1 ? "" : "s"}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
