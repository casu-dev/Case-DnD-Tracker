# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start dev server at http://localhost:3000
npm run build     # Build for production (output: ./dist/)
npm run preview   # Preview production build locally
```

There are no automated tests. Use `sample.state.payload.json` to manually test data mapping logic.

## Architecture

Angular 21 single-page app (standalone components, OnPush change detection, Angular signals for state — no RxJS observables in application code). No backend — communication is peer-to-peer via PeerJS (WebRTC).

### Purpose

Players connect to a DM's 5e.tools initiative tracker via a Room ID. The DM's browser acts as the PeerJS host; the player's browser connects to it and receives JSON state packets whenever the DM's tracker updates.

### Data flow

```
5e.tools (DM) → PeerJS/WebRTC → TrackerSyncService → Angular signals → Components
```

1. `TrackerSyncService` owns the PeerJS connection lifecycle and all state signals (`trackerData`, `connectionState`, `errorMessage`, `reconnectingAttempt`).
2. `AppComponent` reads those signals and conditionally renders either `ConnectionComponent` (no data) or `TrackerComponent` (data present), plus a reconnection modal overlay.
3. Room ID is sourced from the URL fragment (`#v1:<roomId>`) first, then localStorage; both are kept in sync.

### Connection lifecycle

`disconnected → connecting → waiting (peer open, no data yet) → connected`

On connection loss during an active session, the service attempts one auto-reconnect with a 10-second timeout before returning to the disconnected state.

### Data mapping

5e.tools sends raw `RawStatePayload` packets. `TrackerSyncService` maps these to `TrackerData` (see `src/models/tracker.model.ts`). Creature type (`isPlayer`, `isNpc`, `isBoss`) and custom icons are derived from condition names: conditions starting with `fa-` are treated as Font Awesome icon overrides; the strings `"player"`, `"npc"`, and `"boss"` are internal tags that set type flags rather than being shown as status effects.

### Key files

| File | Role |
|------|------|
| `src/services/tracker-sync.service.ts` | PeerJS connection, data transformation, all signals |
| `src/models/tracker.model.ts` | `TrackerData`, `Creature`, `StatusEffect`, raw payload types |
| `src/app.component.ts` | Root; routes between connection and tracker views |
| `src/app/connection/` | Connection form UI |
| `src/app/tracker/` | Initiative tracker display |
| `index.html` | CDN loads for PeerJS 1.5.4 and Font Awesome 6.5.2 |
| `sample.state.payload.json` | Example DM payload for manual testing |

### Styling

Tailwind CSS utilities plus CDN-loaded Font Awesome icons and Google Fonts ("IM Fell English SC" for headers, "Merriweather" for body). D&D parchment aesthetic with reds, golds, and stone grays.
