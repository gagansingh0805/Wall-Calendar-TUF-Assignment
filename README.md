# Interactive Wall Calendar Component

A polished, responsive wall-calendar-inspired component built with Next.js and Tailwind CSS.
It includes date range selection, integrated notes, and client-side persistence for quick frontend-only usage.

## Tech Stack

- Next.js (App Router)
- React
- Tailwind CSS
- TypeScript

## Features

- Wall calendar aesthetic with a hero image and clean segmented layout
- Day range selector with clear states for:
  - Start date
  - End date
  - Days inside the selected range
- Integrated notes:
  - Month-level memo
  - Optional note bound to selected date range
- `localStorage` persistence for notes
- Responsive design:
  - Desktop: image/calendar plus notes panel side-by-side
  - Mobile: stacked layout with touch-friendly controls
- Utility actions: previous/next month, jump to today, clear range
- GIF hero background fetched from API route (`/api/gif`) using Giphy
- Multiple themes: Ocean, Sunset, Midnight

## Run Locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Environment variable for GIF API:

```bash
GIPHY_API_KEY=your_giphy_key
OPENWEATHER_API_KEY=your_openweather_key
```

If `GIPHY_API_KEY` is not provided, the app will fall back to static GIF URLs only.

### Quality Checks

```bash
npm run lint
npm run build
```

## Project Structure

- `app/page.tsx` - page entry rendering the wall calendar
- `components/wall-calendar/WallCalendar.tsx` - main composed feature
- `components/wall-calendar/CalendarGrid.tsx` - calendar grid and range visuals
- `components/wall-calendar/NotesPanel.tsx` - notes UI
- `lib/date.ts` - date/range utilities

## Design Notes / Choices

- The layout emulates a physical wall calendar with the image as the visual anchor.
- Selection behavior is intuitive:
  - first click sets start date
  - second click sets end date
  - reverse order clicks are normalized automatically
- Notes are frontend-only and keyed by month and selected range to meet the no-backend requirement.

## Submission Links

- Source Code (GitHub): [https://github.com/gagansingh0805/Wall-Calendar-TUF-Assignment](https://github.com/gagansingh0805/Wall-Calendar-TUF-Assignment)
- Live Demo: [https://wall-calendar-tuf-assignment.vercel.app/](https://wall-calendar-tuf-assignment.vercel.app/)
