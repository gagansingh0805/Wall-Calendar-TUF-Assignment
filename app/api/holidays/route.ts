import { NextResponse } from "next/server";
import Holidays from "date-holidays";

type HolidayItem = {
  date: string;
  name: string;
};

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
        const key = `${new Date(holiday.date).toISOString().slice(0, 10)}__${holiday.name.toLowerCase()}`;
        if (seen.has(key)) return;
        seen.add(key);
        all.push({ date: holiday.date, name: holiday.name });
      });
    }

    collect((national.getHolidays(year) ?? []).map((h) => ({ date: h.date, name: h.name })));

    states.forEach((state) => {
      const stateHoliday = new Holidays("IN", state);
      collect((stateHoliday.getHolidays(year) ?? []).map((h) => ({ date: h.date, name: h.name })));
    });

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
