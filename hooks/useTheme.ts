"use client";

import { useEffect, useState } from "react";

export type AppearanceMode = "dark" | "light" | "system";

const APPEARANCE_STORAGE_KEY = "wall-calendar-appearance";

function getInitialAppearance(): AppearanceMode {
  if (typeof window === "undefined") return "system";
  const saved = window.localStorage.getItem(APPEARANCE_STORAGE_KEY);
  if (saved === "dark" || saved === "light" || saved === "system") return saved;
  return "system";
}

function resolveIsDark(mode: AppearanceMode): boolean {
  if (mode === "dark") return true;
  if (mode === "light") return false;
  if (typeof window === "undefined") return true;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function useTheme() {
  const [appearance, setAppearance] = useState<AppearanceMode>(getInitialAppearance);
  const isDark = resolveIsDark(appearance);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(APPEARANCE_STORAGE_KEY, appearance);
  }, [appearance]);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.appearance = isDark ? "dark" : "light";
  }, [isDark]);

  return {
    appearance,
    setAppearance,
    isDark,
    toggleAppearance: () => setAppearance((prev) => (resolveIsDark(prev) ? "light" : "dark")),
  };
}
