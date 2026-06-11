# Alternative Question Variations

Add optional alternative phrasings for each question. Manage them in the Questions page, optionally use a random variation during interview sessions, and record which wording was actually shown in session history.

All data continues to live in the user's local data folder (`questions.json` + per-session `metadata.json`). No DB, no new dependencies.

---

## 1. Data model (`src/lib/types.ts`)

- `Question`: add `alternativeQuestions?: string[]` (optional, unlimited).
- `SessionQuestion`: add `displayedQuestion?: string` (the wording actually shown to the user). `questionText` continues to hold the master question for backward compatibility.
- `SessionMetadata.config`: add `useVariations?: boolean` (per-session toggle, default `false`).

All fields optional — old `questions.json` and old sessions keep working unchanged.

---

## 2. Question Management (`src/routes/questions.tsx`)

**Card display (per question)**
- Keep existing main question, badges, and "Show / Hide answer" collapsible.
- Add a second `Collapsible`: **"Show variations" / "Hide variations"** (with `ChevronDown` rotate animation, same visual language as the answer toggle).
  - Trigger only rendered when `alternativeQuestions?.length > 0`; otherwise show a muted "No variations" hint inside the row of badges (or just omit the toggle entirely — TBD, leaning omit to keep the card clean).
  - Content: bullet list of variations inside the same `border bg-muted/30` panel used for the answer, with `whitespace-pre-wrap break-words` and `max-h-72 overflow-y-auto`.
- Add a small badge `Variations: N` next to the existing `Has reference answer` badge when `N > 0`.

**Create/Edit dialog**
- New section "Alternative question variations (optional)" below the reference answer field.
- Renders one `Textarea` per variation with a trash icon button (`Trash2`, ghost variant) to remove it.
- "Add variation" button (`Plus`, outline) appends an empty entry.
- On save: trim each entry, drop empties; store `undefined` if the resulting array is empty.
- No fixed limit. The list is scrollable inside the dialog if it grows tall (`max-h-64 overflow-y-auto`).
- Mobile: each variation row stacks textarea + remove button; remove button stays reachable.

State held locally in the dialog's `editing` object (`editing.alternativeQuestions: string[]`).

---

## 3. Interview session setup (`src/routes/sessions.new.tsx`)

- Add a new `Switch` (or `Checkbox`) setting: **"Use random question variations"** — default off.
  - Help text: "When a question has alternative phrasings saved, the interview will randomly pick one for each appearance. The master question is still used for scoring/review."
- Persist into the session plan (sessionStorage) and into `metadata.json` as `config.useVariations`.

---

## 4. Interview runner (`src/routes/sessions.run.$sessionId.tsx`)

- When advancing to a question:
  - If `config.useVariations === true` and the question has `alternativeQuestions?.length > 0`, pick one uniformly at random from `[question, ...alternativeQuestions]` and use it as the on-screen text.
  - Else display the master `question` as today.
- Selection happens **once per question** (cached for that question slot) so re-renders don't re-pick.
- On save (`writeSessionMetadata`), include `displayedQuestion` on the `SessionQuestion` entry (omit if equal to master, to keep files minimal — TBD; safe default: always include).

Optionally extract the picker into `src/lib/interview/variation.ts` (`pickDisplayedQuestion(q, useVariations)`) for clarity and unit-testability.

---

## 5. Session review (`src/routes/sessions.$sessionId.tsx`)

For each recorded answer:
- Keep showing the master question as the card title (so history stays organized by topic).
- If `displayedQuestion` exists and differs from `questionText`, show a small subline under the title:
  > **Asked as:** "{displayedQuestion}"
- Reference answer block stays unchanged.

This satisfies "review the exact version you answered" without disrupting the existing layout.

---

## Out of scope
- No persistent user preference across sessions (per-session toggle only).
- No weighting / "never repeat last wording" logic — strictly uniform random.
- No edits to existing recordings or migration scripts.

## Files touched
- `src/lib/types.ts`
- `src/routes/questions.tsx`
- `src/routes/sessions.new.tsx`
- `src/routes/sessions.run.$sessionId.tsx`
- `src/routes/sessions.$sessionId.tsx`
- (optional) `src/lib/interview/variation.ts`
