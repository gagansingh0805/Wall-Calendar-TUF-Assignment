import { NextResponse } from "next/server";
import { toLocalDateKey } from "@/lib/date";

type OneCallDailyItem = {
  dt: number;
  weather?: Array<{ icon?: string; description?: string }>;
};

type OneCallResponse = {
  daily?: OneCallDailyItem[];
};

export async function GET(request: Request) {
  try {
    const apiKey = process.env.OPENWEATHER_API_KEY?.trim();
    if (!apiKey) {
      return NextResponse.json({ forecast: [], error: "Missing OPENWEATHER_API_KEY" }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const lat = Number(searchParams.get("lat"));
    const lon = Number(searchParams.get("lon"));
    const safeLat = Number.isFinite(lat) ? lat : 28.6139;
    const safeLon = Number.isFinite(lon) ? lon : 77.209;

    const url = new URL("https://api.openweathermap.org/data/3.0/onecall");
    url.searchParams.set("lat", String(safeLat));
    url.searchParams.set("lon", String(safeLon));
    url.searchParams.set("exclude", "minutely,hourly,alerts,current");
    url.searchParams.set("units", "metric");
    url.searchParams.set("appid", apiKey);

    const response = await fetch(url.toString(), { cache: "no-store" });
    if (!response.ok) {
      return NextResponse.json({ forecast: [] }, { status: 200 });
    }
    const data = (await response.json()) as OneCallResponse;

    const forecast = (data.daily ?? [])
      .slice(0, 7)
      .map((item) => {
        const icon = item.weather?.[0]?.icon?.trim() || "";
        const description = item.weather?.[0]?.description?.trim() || "Forecast";
        if (!item.dt || !icon) return null;
        const date = toLocalDateKey(new Date(item.dt * 1000));
        return { date, icon, description };
      })
      .filter((item): item is { date: string; icon: string; description: string } => Boolean(item));

    return NextResponse.json({ forecast });
  } catch {
    return NextResponse.json({ forecast: [] }, { status: 200 });
  }
}
