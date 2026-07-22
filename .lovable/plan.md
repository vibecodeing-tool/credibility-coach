## Changes

### 1. Speaking Drill — peek answer while recording
In `src/routes/drill.tsx`, add the same Show/Hide reference answer toggle inside the `recording` phase card (below the video/timer, above the Stop button). Reuses the existing `showAnswer` state. Small, unobtrusive ghost button so it doesn't distract; collapsed by default so users only see it if they choose.

### 2. Questions page — "Readable" answer view
In `src/routes/questions.tsx`, keep the existing inline collapsible answer preview. Add a second button next to it: **"Read"** (BookOpen icon) that opens a shadcn `Dialog` showing the answer in a large, comfortably formatted panel:
- Wider modal (max-w-2xl), generous padding
- Larger type (`text-base leading-relaxed`), `whitespace-pre-wrap`
- Scrollable body for long answers
- Shows the question as the dialog title for context
- Single shared dialog driven by a `readingQuestion` state (one dialog instance, not per-card)

### 3. Dark mode
- Add a `ThemeProvider` (`src/components/theme-provider.tsx`) that toggles a `dark` class on `<html>`, persists choice to `localStorage`, defaults to system preference.
- Add a `ThemeToggle` (sun/moon icon button) in `src/components/app-sidebar.tsx` footer.
- Mount the provider in `src/routes/__root.tsx`.
- Retune `src/styles.css` dark palette to a modern, readable Claude/Lovable-style scheme (warm near-black background, soft off-white foreground, muted borders, calibrated primary/accent contrast) using existing oklch tokens — no component-level color changes needed since everything uses semantic tokens.
- Verify `recording` / `recording-foreground` and sidebar tokens have proper dark variants.

## Technical notes
- Tailwind v4 dark variant is already set up via `@custom-variant dark` in `src/styles.css` (class-based). Provider just toggles the class.
- No new dependencies. shadcn `Dialog` and `lucide-react` icons (`Sun`, `Moon`, `BookOpen`) are already available.
- No changes to filesystem, session runner, or data shapes.

## Files touched
- `src/routes/drill.tsx` — toggle inside recording phase
- `src/routes/questions.tsx` — "Read" dialog button + shared Dialog
- `src/components/theme-provider.tsx` — new
- `src/components/theme-toggle.tsx` — new
- `src/components/app-sidebar.tsx` — mount toggle
- `src/routes/__root.tsx` — wrap with ThemeProvider
- `src/styles.css` — refined dark tokens
