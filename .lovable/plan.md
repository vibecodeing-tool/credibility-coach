## Cloud Backup & Restore (manual, local-first)

Your local folder stays the single source of truth. Nothing syncs automatically. The cloud is only touched when you press Upload, Update, or Load.

### Tech note (important)
Node + Express + MongoDB can't run in this project — it's a TanStack Start app on Lovable Cloud (Postgres). I'll build the same feature with Lovable Cloud: one `backups` table plus server functions that behave exactly like the REST endpoints you described. No accounts, no login.

Also: recorded `.webm` videos are excluded from the backup (far too large for a JSON document). The backup covers `questions.json` and every session's `metadata.json`. Restoring on a new device gives you all questions and session records; videos remain only on the device that recorded them, and the review page will show a "recording not on this device" note when a file is missing.

### 1. Cloud storage
Enable Lovable Cloud and add one table:

```
backups
  backup_key  text primary key   -- e.g. CAS-8M2P7XQ4L9A1V6R5TZH
  version     int  default 1
  data        jsonb              -- { questions: [...], sessions: [...] }
  created_at  timestamptz
  updated_at  timestamptz
```

Row-level security stays on with no public policies — all access goes through server functions, so a backup key is the only way in. Keys are 20 random chars from a crypto RNG using an unambiguous alphabet (no 0/O/1/I), giving a practically unguessable key.

### 2. Server functions (`src/lib/backup/backup.functions.ts`)
- `createBackup({ data })` → generates a fresh key, inserts, returns `{ backupKey, updatedAt }`
- `updateBackup({ backupKey, data, knownUpdatedAt })` → overwrites `data`, bumps `updated_at`. If the cloud row's `updated_at` is newer than `knownUpdatedAt`, it returns `{ conflict: true, cloudUpdatedAt }` instead of writing.
- `getBackup({ backupKey })` → returns the row, or `{ notFound: true }`
- Rate-limited lightly by key format validation; invalid keys are rejected before hitting the DB.

### 3. Local snapshot layer (`src/lib/backup/snapshot.ts`)
- `collectSnapshot(root)` — reads `questions.json` and walks `sessions/*/metadata.json` into one JSON object.
- `applySnapshot(root, data)` — writes `questions.json` and recreates each `sessions/<id>/metadata.json`. Existing local videos are left untouched, so a restore on the original device keeps playback working.
- A local `backup.json` in your data folder remembers your `backupKey` and the `updatedAt` of the last upload, so Update and conflict checks work without you retyping the key.

### 4. New page `/backup` (sidebar item "Cloud Backup", cloud icon)
- **Status card** — shows local counts (questions, sessions) and, if a key is stored, the key with a copy button plus "last uploaded at".
- **Upload new backup** — creates a fresh key; shows the key prominently with copy and a "save this key" warning.
- **Update backup** — enabled only when a key is stored; overwrites the cloud copy, same key.
- **Load backup** — key input → fetches → shows a confirmation dialog listing what's in the cloud copy (counts + updated date) versus what's local, with an explicit warning that local questions and session records will be replaced. Only replaces on confirm.
- Conflict warnings both directions: uploading over newer cloud data, or loading cloud data older than the local snapshot, each require a second confirmation.
- Toasts for success/error via existing `sonner`.

### 5. Untouched
Interview runner, drill mode, question management, timers, theming, and all existing local reads/writes stay exactly as they are.

### Files
- new: `src/routes/backup.tsx`, `src/lib/backup/snapshot.ts`, `src/lib/backup/backup.functions.ts`, `src/lib/backup/keys.ts`, one DB migration
- edited: `src/components/app-sidebar.tsx`, `src/lib/fs/store.ts` (snapshot helpers), `src/routes/sessions.$sessionId.tsx` (missing-video note)
