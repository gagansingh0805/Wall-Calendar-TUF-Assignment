import { WallCalendar } from "@/components/wall-calendar/WallCalendar";

export default function Home() {
  return (
    <main className="calendar-page px-4 py-8 sm:px-6 lg:px-8">
      <div className="calendar-stars" aria-hidden />
      <div className="calendar-stars calendar-stars-layer2" aria-hidden />
      <span className="shooting-star shooting-star-1" aria-hidden />
      <span className="shooting-star shooting-star-2" aria-hidden />
      <span className="shooting-star shooting-star-3" aria-hidden />
      <WallCalendar />
    </main>
  );
}
