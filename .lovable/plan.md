# Speaking Drill Mode (Quick Practice)

A lightweight practice flow for a single question — stopwatch + temporary in-memory recording, nothing written to disk.

## New route

`src/routes/drill.tsx` → `/drill`

Added to the sidebar nav (`src/components/app-sidebar.tsx`) as "Speaking Drill" with a `Timer`/`Mic` icon, beside Questions and Sessions.

## UI flow

Single page, three states driven by local component state — no router state, no persistence.

**1. Select**

- Question picker: searchable `Select` (or simple list with filter input) populated from `useQuestions()`.
- Shows question text, category badge, and `Target: Xs` if `answerTime` is set.
- Primary button: **Start Practice** (disabled until a question is picked).

**2. Recording**

- Large displayed question at top.
- Live MM:SS stopwatch (updates every 100ms, rendered to seconds).
- Red "● Recording" pill (reuses the recording-dot style from the runner).
- Webcam preview (mirrored, same styling as `sessions.run`).
- Controls: **Stop Recording**, **Cancel**.
- If `answerTime` is set, show a subtle "Target: 60s" label next to the stopwatch. We do NOT auto-stop — the user controls duration.

**3. Playback**

- `<video controls>` bound to a `URL.createObjectURL(blob)` for the just-captured webm.
- Stats row:
  - "Your attempt: 42s"
  - "Target: 60s" (only if `answerTime` set), plus a small delta chip ("-18s under" / "+5s over").
- Controls: **Retry Practice** (revokes the object URL, clears blob, resets stopwatch, returns to Select state with the same question pre-selected), **Pick a different question** (returns to Select cleared).

## Temporary-only recording

- `MediaRecorder` chunks held in a `useRef<Blob[]>`; final `Blob` kept in component state.
- Object URL stored in a ref and revoked on: new attempt, question change, unmount.
- No calls into `src/lib/fs/store.ts`, no `writeBlob`, no metadata writes. Nothing touches the session folder.
- Each new attempt overwrites the previous blob and revokes the prior object URL — only one recording exists at a time.

## Reused building blocks

- `useQuestions()` for the question list.
- `pickMime()` + `getUserMedia` pattern copied (small, local) from `sessions.run.$sessionId.tsx` — kept inline rather than extracted, to avoid touching the runner.
- Existing shadcn components: `Button`, `Select`, `Card`, `Badge`.
- Recording dot styling already exists in `styles.css` (`.recording-dot`, `--recording`).

## Files touched

- **New**: `src/routes/drill.tsx`
- **Edited**: `src/components/app-sidebar.tsx` (add nav link)

## Out of scope

- Not saved to sessions, history, or any JSON metadata.
- No auto-stop on target time.
- No drill-mode analytics / streaks.
- No changes to existing session runner, question manager, or types.