import { NextResponse } from "next/server";
import Holidays from "date-holidays";

type HolidayItem = {
  date: string;
  name: string;
};

<<<<<<< HEAD
const FESTIVAL_ALIAS_RULES: Array<{ canonical: string; aliases: RegExp[] }> = [
  {
    canonical: "Holi",
    aliases: [/\bholi\b/i, /\bdhuleti\b/i, /\bdhulandi\b/i, /\bdol\s*jatra\b/i],
  },
  {
    canonical: "Diwali",
    aliases: [/\bdiwali\b/i, /\bdeepavali\b/i, /\bdivali\b/i],
  },
];

const MANUAL_FESTIVAL_DATES: Record<number, { holi: string; diwali: string }> = {
  2024: { holi: "2024-03-25", diwali: "2024-11-01" },
  2025: { holi: "2025-03-14", diwali: "2025-10-20" },
  2026: { holi: "2026-03-04", diwali: "2026-11-08" },
  2027: { holi: "2027-03-22", diwali: "2027-10-29" },
  2028: { holi: "2028-03-11", diwali: "2028-10-17" },
};

function canonicalizeFestivalName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return name;
  for (const rule of FESTIVAL_ALIAS_RULES) {
    if (rule.aliases.some((regex) => regex.test(trimmed))) {
      return rule.canonical;
    }
  }
  return name;
}

=======
type FestivalAliasRule = {
  canonicalName: string;
  canonicalMatcher: RegExp;
  sourceMatchers: RegExp[];
};

const FESTIVAL_ALIAS_RULES: FestivalAliasRule[] = [
  {
    canonicalName: "Holi",
    canonicalMatcher: /\bholi\b/i,
    sourceMatchers: [/\bholi\b/i, /\bdhuleti\b/i, /\bdhulandi\b/i, /\bdol\s+jatra\b/i, /\bdhulendi\b/i],
  },
  {
    canonicalName: "Diwali",
    canonicalMatcher: /\bdiwali\b/i,
    sourceMatchers: [/\bdiwali\b/i, /\bdeepavali\b/i, /\bdivali\b/i],
  },
];

>>>>>>> dccd219 (FIXED SO MUCH)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const yearParam = Number(searchParams.get("year"));
    const year = Number.isFinite(yearParam) && yearParam > 1900 ? yearParam : new Date().getFullYear();
    const monthParam = Number(searchParams.get("month"));
    const month = Number.isFinite(monthParam) && monthParam >= 1 && monthParam <= 12 ? monthParam : undefined;

    const national = new Holidays("IN");
    const states = Object.keys(national.getStates("IN") ?? {});
    const seen = new Set<string>();
    const all: HolidayItem[] = [];

    function collect(items: Array<{ date: string; name: string }>) {
      items.forEach((holiday) => {
        const normalizedName = canonicalizeFestivalName(holiday.name);
        const key = `${new Date(holiday.date).toISOString().slice(0, 10)}__${normalizedName.toLowerCase()}`;
        if (seen.has(key)) return;
        seen.add(key);
        all.push({ date: holiday.date, name: normalizedName });
      });
    }

    collect((national.getHolidays(year) ?? []).map((h) => ({ date: h.date, name: h.name })));

    states.forEach((state) => {
      const stateHoliday = new Holidays("IN", state);
      collect((stateHoliday.getHolidays(year) ?? []).map((h) => ({ date: h.date, name: h.name })));
    });

<<<<<<< HEAD
    const hasHoli = all.some((holiday) => holiday.name.toLowerCase() === "holi");
    const hasDiwali = all.some((holiday) => holiday.name.toLowerCase() === "diwali");
    const manual = MANUAL_FESTIVAL_DATES[year];
    if (manual) {
      const fallbackEntries: Array<{ date: string; name: string }> = [];
      if (!hasHoli) fallbackEntries.push({ date: `${manual.holi}T12:00:00+05:30`, name: "Holi" });
      if (!hasDiwali) fallbackEntries.push({ date: `${manual.diwali}T12:00:00+05:30`, name: "Diwali" });
      if (fallbackEntries.length > 0) collect(fallbackEntries);
    }
=======
    FESTIVAL_ALIAS_RULES.forEach((rule) => {
      const hasCanonical = all.some((holiday) => rule.canonicalMatcher.test(holiday.name));
      if (hasCanonical) return;
      const source = all.find((holiday) => rule.sourceMatchers.some((matcher) => matcher.test(holiday.name)));
      if (!source) return;
      collect([{ date: source.date, name: rule.canonicalName }]);
    });
>>>>>>> dccd219 (FIXED SO MUCH)

    const filtered = all
      .filter((holiday) => {
        if (!month) return true;
        const value = new Date(holiday.date);
        return value.getMonth() + 1 === month;
      })
      .map((holiday) => ({
        date: holiday.date,
        name: holiday.name,
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return NextResponse.json({ year, month: month ?? null, holidays: filtered satisfies HolidayItem[] });
  } catch {
    return NextResponse.json({ year: null, month: null, holidays: [] });
  }
}
