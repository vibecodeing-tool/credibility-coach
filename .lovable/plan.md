## Changes to `src/routes/questions.tsx`

### 1. Broader search scope
Update the `filtered` memo so the search query matches against:
- The main `question` text (as today)
- Every entry in `alternativeQuestions` (variations)
- The `answer` text — only when the "Search answers" toggle is on

### 2. "Search answers" toggle
Add a small toggle next to the search input (shadcn `Toggle` or a compact `Button` with an icon like `FileText`, using `variant="outline"` / `pressed` state). Default off. When on:
- Answer text is included in the filter above.
- On each matching card, if the match came from the answer (i.e. the query appears in the answer but not in the question or variations), auto-reveal the collapsible answer preview and scroll the matching snippet into view.
- The matched substring inside the answer is highlighted with a `<mark>` using the existing accent token (no new colors).

### 3. Variation match hint
When the query matches a variation (but not the main question), show a subtle line under the question title on that card:
`Matches variation: "…<highlighted snippet>…"` — using the first matching variation, truncated to ~120 chars around the match. Uses `text-muted-foreground text-xs`.

### 4. Helper
Add a small `highlightMatch(text, query)` helper inside the file that returns a React fragment with `<mark className="bg-accent/40 rounded-sm px-0.5">` around case-insensitive matches. Reused by the variation hint and the answer preview.

## Not changed
- No changes to data model, storage, other routes, or dark mode.
- The existing per-card "Show/Hide answer" and "Read" dialog stay as-is; the search-driven auto-reveal only forces the collapsible open when an answer-match is found and search-answers is enabled.

## Files touched
- `src/routes/questions.tsx`
