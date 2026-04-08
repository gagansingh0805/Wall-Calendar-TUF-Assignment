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
```

If not provided, the app will fall back to static GIF URLs only.

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

- Repository: `<add-public-github-or-gitlab-link>`
- Video demo (required): `<add-loom-or-youtube-link>`
- Live demo (optional): `<add-vercel-or-netlify-link>`

## Suggested Video Walkthrough Script

1. Show desktop layout and visual wall-calendar styling.
2. Select a date range and show start/end/in-between highlight behavior.
3. Add month note and range note.
4. Refresh page to demonstrate persistence.
5. Resize to mobile width and demonstrate usability.
