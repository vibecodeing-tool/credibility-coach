## Recording Countdown & Alert Sounds

Add real-world-style audio cues around recording start/stop in both the **Speaking Drill** (`/drill`) and **Interview Session** (`/sessions/run/$sessionId`) flows.

### Sound cues

| Moment | Sound |
|---|---|
| Last 3 seconds of reading/prep countdown (3, 2, 1) | Short high "tick" beep (≈880 Hz, 120 ms) |
| Recording starts | Longer confirm beep (≈1200 Hz, 250 ms) |
| Recording ends (auto-stop OR manual stop) | Lower end beep (≈500 Hz, 350 ms) |

Mirrors common camera/recording apps (e.g. Loom, iOS camera self-timer).

### Implementation

1. **New helper** `src/lib/audio/cues.ts`
   - Tiny WebAudio module — no asset files, no extra deps.
   - Lazily creates one shared `AudioContext` on first use (must be triggered from a user gesture, which both flows already have: "Start" buttons).
   - Exports `playTick()`, `playStart()`, `playEnd()` using `OscillatorNode` + `GainNode` with a short attack/decay envelope so they sound like clean beeps, not clicks.
   - Exports `resumeAudio()` to unlock the context on the first click.
   - Safe no-op on SSR / when `AudioContext` is unavailable.

2. **`src/routes/sessions.run.$sessionId.tsx`**
   - Call `resumeAudio()` inside the existing "Start" / begin handler.
   - In the reading-phase countdown loop, call `playTick()` when `secondsLeft` becomes 3, 2, or 1.
   - Call `playStart()` immediately before `setPhase("recording")` and `recorder.start()`.
   - Call `playEnd()` when the recorder stops — both on auto-stop (answer timer hits 0) and on manual "Next/Stop" click, in one place inside the existing stop helper to avoid double-firing.

3. **`src/routes/drill.tsx`**
   - Same wiring, adapted to the drill state machine:
     - On "Start Practice" click → `resumeAudio()`.
     - Drill currently starts recording immediately (no reading countdown). Add an optional **3-2-1 pre-roll** before `MediaRecorder.start()`:
       - Show a large `3 → 2 → 1` overlay on the webcam preview, 1 second per number, playing `playTick()` each step.
       - Then `playStart()` and begin recording + stopwatch.
     - On stop (manual, auto-stop in AUTO/TIMED modes, or cancel-then-finish) → `playEnd()` once.
   - Pre-roll applies to all three modes (AUTO / FREE / TIMED).

### Out of scope

- No user setting to mute sounds (can be added later if requested).
- No bundled audio files — synthesized so there's nothing to download or ship.
- No changes to session metadata, types, or persisted recordings.

### Files

- **Create:** `src/lib/audio/cues.ts`
- **Edit:** `src/routes/sessions.run.$sessionId.tsx`, `src/routes/drill.tsx`
