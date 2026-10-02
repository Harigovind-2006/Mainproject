# CLAUDE.md — Frontend (Fleet Progress Tracker)

Context for Claude Code when working inside `/frontend`. This is the dashboard half of a larger project; see the backend's own CLAUDE.md for the server side. Both must agree on the WebSocket contract defined below — if the backend changes its message shape, update `lib/types.ts` here to match.

## What this app does
A live operator dashboard showing one or more connected vehicles: position on the planned route, % complete, ETA, schedule drift (`delta_T`), and which correction mode is active. No login, no backend database queries — everything is driven by a live WebSocket feed from the backend.

## Tech stack (decided)
- Next.js (App Router), TypeScript.
- Tailwind CSS for styling.
- Zustand for client-side state (single fleet store — see `lib/store.ts`).
- Recharts for the live ΔT line chart.
- Plain SVG for the route/path visualization — **no map library (Leaflet/Mapbox)**. The route is a local simulated layout, not real-world GPS, so a map library is unnecessary overhead until real GPS coordinates are wired in later.
- **No auth.** No login page, no session/JWT handling. Do not add this unless explicitly asked again.

## File layout (already scaffolded — extend here)