"use client";

import { useEffect } from "react";

type KeyboardShortcutsConfig = {
  onQuickAdd: () => void;
  onToggleAppearance: () => void;
  onSwitchToMonthMemo: () => void;
  onSwitchToRangeNote: () => void;
  onSwitchToRecurring: () => void;
  onSwitchToHolidays: () => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onEscape: () => void;
};

function isTypingTarget(target: EventTarget | null): boolean {
  const node = target as HTMLElement | null;
  if (!node) return false;
  const tag = node.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || node.isContentEditable;
}

export function useKeyboardShortcuts({
  onQuickAdd,
  onToggleAppearance,
  onSwitchToMonthMemo,
  onSwitchToRangeNote,
  onSwitchToRecurring,
  onSwitchToHolidays,
  onPrevMonth,
  onNextMonth,
  onEscape,
}: KeyboardShortcutsConfig) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (isTypingTarget(event.target)) return;
      const key = event.key.toLowerCase();

      if (key === "n" || key === "/") {
        event.preventDefault();
        onQuickAdd();
        return;
      }
      if (key === "d") {
        event.preventDefault();
        onToggleAppearance();
        return;
      }
      if (key === "j" || key === "arrowleft") {
        event.preventDefault();
        onPrevMonth();
        return;
      }
      if (key === "k" || key === "arrowright") {
        event.preventDefault();
        onNextMonth();
        return;
      }
      if (key === "escape") {
        onEscape();
        return;
      }
      if (key === "1") onSwitchToMonthMemo();
      if (key === "2") onSwitchToRangeNote();
      if (key === "3") onSwitchToRecurring();
      if (key === "4") onSwitchToHolidays();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    onQuickAdd,
    onNextMonth,
    onPrevMonth,
    onEscape,
    onSwitchToHolidays,
    onSwitchToMonthMemo,
    onSwitchToRangeNote,
    onSwitchToRecurring,
    onToggleAppearance,
  ]);
}
