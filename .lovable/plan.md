# Question Answer Preview

Add a per-question "Show / Hide answer" toggle on the Questions page so the reference answer can be peeked at without opening the edit dialog. Answer stays hidden by default.

## Scope
- File: `src/routes/questions.tsx` only.
- No changes to types, storage, session flow, or review page.

## UI changes (per question card)
- Add a `Collapsible` (shadcn `@/components/ui/collapsible`) below the badges row.
- Trigger: a small ghost `Button` with chevron icon (`ChevronDown` rotating on open) and label that flips between **Show answer** ↔ **Hide answer**.
- Content panel:
  - If `q.answer?.trim()`: muted bordered box (`rounded-md border bg-muted/30 p-3 text-sm leading-relaxed whitespace-pre-wrap break-words`) so long answers wrap and preserve line breaks. `max-h-72 overflow-y-auto` to cap height on very long answers.
  - Else: muted italic line **"No reference answer available."**
- Local open state kept in a `Record<string, boolean>` keyed by question id (resets on reload — fine).

## Responsiveness
- Collapsible spans full card width; trigger left-aligned, sits under the badge row so it stacks naturally on mobile.
- `break-words` + scrollable max-height handle long pasted answers on narrow screens.

## Out of scope
- Editing answer inline (still via existing edit dialog).
- Global expand/collapse all.
- Showing answer anywhere during an interview.
