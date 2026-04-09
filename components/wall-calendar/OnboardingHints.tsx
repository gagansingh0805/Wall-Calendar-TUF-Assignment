"use client";

type OnboardingHintsProps = {
  activeAction: "monthMemo" | "rangeNote" | "recurring" | "holidays";
};

const hints: Record<OnboardingHintsProps["activeAction"], string> = {
  monthMemo: "Tip: click a date and press N for quick add.",
  rangeNote: "Tip: drag across dates to capture a full range.",
  recurring: "Tip: in Monthly mode, click dates to toggle month days.",
  holidays: "Tip: use search to filter festivals instantly.",
};

export function OnboardingHints({ activeAction }: OnboardingHintsProps) {
  return <p className="calendar-muted rounded-lg border border-[color:var(--theme-panel-border)] px-2.5 py-1.5 text-[11px]">{hints[activeAction]}</p>;
}
