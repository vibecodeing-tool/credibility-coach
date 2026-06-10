
# Manual question transitions + completion screen

After the answer timer ends and the recording saves, stop and show a confirmation screen with a **Next question** button instead of auto-advancing. Add a session-level setting to opt back into the old auto behavior.

## 1. New setting on `/sessions/new`

File: `src/routes/sessions.new.tsx`

- Add state `transitionMode: "manual" | "automatic"` (default `"manual"`).
- New card "Interview settings" with a `RadioGroup`:
  - **Manual (recommended)** — "Pause after each answer; you click Next question to continue."
  - **Automatic** — "Move to the next question as soon as the recording is saved."
- Persist alongside the existing plan in sessionStorage. Two options, pick (a):
  - (a) Add `transitionMode` into the `cas:plan:${sessionId}` payload as a top-level field by switching the stored shape to `{ transitionMode, questions: [...] }`. The runner reads it back.
  - Also extend `SessionMetadata["config"]` with `transitionMode` so it's recorded in the session.json for history.

## 2. Runner: pause between questions

File: `src/routes/sessions.run.$sessionId.tsx`

- Extend the `Phase` union with `"between"` (post-save, pre-next) and `"finished"` (after last save, pre-summary).
- Read `transitionMode` from the parsed sessionStorage payload; store in a ref/state.
- After `writeSessionMetadata` succeeds inside `runRecording`:
  - If `transitionMode === "automatic"`: keep current behavior (advance index, set `"reading"`; or mark complete + `"done"` on last).
  - If `transitionMode === "manual"`:
    - On non-final question → `setPhase("between")`. Do NOT increment index yet; do NOT tear down the media stream.
    - On final question → write `completed: true` metadata, `setPhase("finished")`. (Stream can be stopped here.)
- Add a handler `handleNext()` that increments `index` and sets phase back to `"reading"` (kicks the existing state-machine effect, which will start a new countdown and recorder using the still-live stream).
- The countdown effect already keys on `[phase, index, plan]`, so resetting to `"reading"` for the new index works without other changes. The webcam preview keeps showing the live stream during `"between"`.

## 3. Between-question UI

In the main body grid, when `phase === "between"`:

- Replace the question/countdown column with a centered card:
  - Big check icon (lucide `CheckCircle2`) in `text-primary`.
  - Heading: **"Answer recorded successfully"**.
  - Subtext: `Question {index + 1} of {plan.length} completed`.
  - Primary button **"Next question"** with `ArrowRight` icon → calls `handleNext()`.
  - Secondary ghost button **"Abort interview"** reusing the existing `setShowAbort(true)` flow.
- Keep the webcam panel visible on the right so the user can see they're still on camera.
- Top bar: hide the REC pill (already conditional on `recording`); progress bar value updates because index/phase changed.

When `phase === "finished"`:

- Full-screen centered card:
  - Heading **"Interview completed"**, subtext "All {plan.length} answers saved to your folder."
  - Primary button **"View session summary"** → `navigate({ to: "/sessions/$sessionId", params: { sessionId } })`.
  - Secondary link "Back to sessions" → `/sessions`.
- Tear down media stream on entering this phase (call `cleanup()` once).

The existing `phase === "done"` auto-navigates to `/sessions/complete/$sessionId`; keep that path for automatic mode and route manual mode through `"finished"` instead so the user sees the new screen before leaving.

## 4. Types

File: `src/lib/types.ts`

- Add `transitionMode?: "manual" | "automatic"` to `SessionMetadata["config"]`.

## Out of scope

- No changes to storage layout, video file naming, or the session review/history pages.
- No persistent user preference across sessions — the mode is per-session (chosen in `/sessions/new`, remembered for the duration of that run via sessionStorage + metadata).
- No keyboard shortcut for "Next question" (can be added later).
