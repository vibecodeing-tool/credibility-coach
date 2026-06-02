# CAS Interview Simulator — Plan

A desktop-first, mobile-responsive web app that simulates a UK Student Visa Credibility Interview. Strictly local: questions and recordings are written to a folder the user picks on their own machine via the File System Access API. No backend, no database, no auth, no AI.

## Important constraints

- **Not Tauri.** Lovable runs a TanStack Start web app. We deliver the same UX in the browser.
- **File System Access API is Chromium-only on desktop** (Chrome, Edge, Arc, Brave, Opera). Safari and Firefox don't support it; mobile support is effectively none. The app will detect this and show a clear "unsupported browser" screen rather than silently falling back.
- **Mobile-responsive layout is included**, but recording + file-saving realistically work on desktop Chromium. Mobile users can still browse history if they open the same folder on a desktop later.
- **Folder handle persistence**: the picked folder handle is stored in IndexedDB so the user only picks it once. On return visits the browser asks for a one-click permission re-grant.

## User flow

1. First launch → "Choose your data folder" screen. User picks an empty folder; we create `questions.json` and a `sessions/` subfolder inside it.
2. Dashboard → stats + quick actions.
3. Questions → CRUD, search, category filter.
4. New Session → name + configuration (mode, count, range) → summary → Start.
5. Interview runner → fully locked CAS mode (see below).
6. Completion screen → summary + link to the session in History.
7. History → list of sessions; open one to review recordings inline with a download button per clip.

## Fully locked CAS mode

- No pause, no skip, no back, no manual "next."
- Reading timer counts down (no recording).
- At 0, mic + webcam start automatically via `MediaRecorder` (`video/webm;codecs=vp9,opus`, fallback `vp8`).
- Live webcam preview + red `● Recording` indicator + answer countdown.
- At 0, recording stops, blob is written to the session folder, runner advances immediately to the next question.
- Only escape hatch: an **Abort interview** button in the corner that asks for confirmation, stops recording, marks the session `completed: false`, and exits.
- Permission denial or device error during the run aborts the session with a clear message.

## Storage layout (written into the user's chosen folder)

```
<chosen folder>/
├── questions.json
└── sessions/
    └── CAS_Mock_Interview_2026-06-02_14-30/
        ├── metadata.json
        ├── 01_why_did_you_choose_the_uk.webm
        ├── 02_why_this_university.webm
        └── ...
```

Schemas match your spec exactly (`Question`, session `metadata.json`, per-question record with `videoFile` + `recordingDuration`). Filenames are sanitized: lowercase, alphanumerics + underscores, max ~60 chars, zero-padded index prefix.

## Pages & routes (TanStack Start file-based routes)

- `/` Dashboard — totals: questions, sessions, recorded answers, interview hours.
- `/questions` Question management — table + search + category filter + create/edit/delete dialogs.
- `/sessions/new` Session creation wizard — name → configure (mode, count, range) → summary.
- `/sessions/run/$sessionId` Interview runner (fullscreen, locked).
- `/sessions/complete/$sessionId` Completion screen.
- `/sessions` History list.
- `/sessions/$sessionId` Review (per-question video player + download).
- `/setup` Folder picker / permission re-grant (shown automatically when no folder handle).

## Navigation

- Desktop: shadcn `Sidebar` (collapsible to icon strip) with Dashboard, Questions, New Session, History. Active route highlighted via `useRouterState`.
- Mobile: sidebar collapses to a `Sheet` triggered from a top bar.
- Interview runner route hides the sidebar (fullscreen focus mode).

## Architecture / file layout

```
src/
├── routes/                    # pages above
├── components/
│   ├── app-sidebar.tsx
│   ├── top-bar.tsx
│   ├── questions/             # QuestionTable, QuestionFormDialog, DeleteConfirm
│   ├── sessions/              # SessionConfigForm, SessionSummary, SessionCard
│   ├── interview/             # ReadingPhase, RecordingPhase, WebcamPreview,
│   │                            CountdownRing, RecordingIndicator, AbortDialog
│   └── ui/                    # shadcn primitives (existing)
├── hooks/
│   ├── use-fs-root.ts         # folder handle + permission state
│   ├── use-questions.ts       # CRUD against questions.json
│   ├── use-sessions.ts        # list/read/delete sessions
│   ├── use-media-recorder.ts  # start/stop, blob handoff
│   └── use-countdown.ts       # tick-accurate countdown
├── lib/
│   ├── fs/
│   │   ├── root-handle.ts     # IndexedDB persist + verify/request permission
│   │   ├── questions-store.ts # read/write questions.json
│   │   ├── sessions-store.ts  # create folder, write metadata, write blob, list, delete
│   │   └── filenames.ts       # sanitize + zero-pad
│   ├── interview/
│   │   ├── selector.ts        # sequential/random + range + count
│   │   └── runner-machine.ts  # phase state machine (idle→reading→recording→saving→next→done)
│   └── types.ts               # Question, Session, SessionQuestion
└── styles.css                 # design tokens
```

State is local (React + custom hooks). No global store needed; the runner uses a small state machine inside its route.

## Design system

Modern, professional, calm. Single accent for primary actions; a dedicated "recording red" token used only for the live indicator and abort button. Generous spacing, large readable question typography during the interview, monospace countdown numerals. Tokens defined in `src/styles.css` (oklch); shadcn components themed via those tokens.

## Out of scope (explicitly)

- Tauri packaging, native installers, Rust code.
- Any cloud sync, account system, or AI feedback.
- Editing recordings after the fact.
- Safari / Firefox / mobile recording support (graceful unsupported message instead).

## Build order

1. Folder picker + persistence + `questions.json` read/write.
2. Questions page (CRUD, search, filter).
3. Session creation wizard + question selector.
4. Interview runner (state machine, timers, MediaRecorder, file writing, locked CAS rules).
5. History list + Review page (video playback + download).
6. Dashboard stats.
7. Sidebar/topbar, responsive polish, empty states, confirmations.  
  
also :  
Use File System Access API to store all data as real files on the user's machine.
  The user must select a folder (CAS-Interview), and all sessions, metadata, and .webm recordings must be written into subfolders inside it.
  Ensure:
  - session.json is updated after every question
  - each answer is saved as a .webm file
  - no IndexedDB is used for primary storage
  - no backend or cloud storage
  Data must remain accessible from the file explorer after closing the app.