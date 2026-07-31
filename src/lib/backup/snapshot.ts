import {
  listSessions,
  readBackupMeta,
  readQuestions,
  writeBackupMeta,
  writeQuestions,
  writeSessionMetadata,
} from "@/lib/fs/store";
import type { Question, SessionMetadata } from "@/lib/types";

export interface LocalSnapshot {
  questions: Question[];
  sessions: SessionMetadata[];
  settings?: Record<string, unknown>;
}

export interface BackupMeta {
  backupKey: string;
  updatedAt: string;
}

/** Reads every piece of local JSON data into one plain object. Videos are excluded. */
export async function collectSnapshot(root: FileSystemDirectoryHandle): Promise<LocalSnapshot> {
  const [questions, sessions] = await Promise.all([readQuestions(root), listSessions(root)]);
  return { questions, sessions, settings: {} };
}

/**
 * Replaces local JSON data with the given snapshot. Local recordings are left
 * on disk, so sessions that already exist keep their playable video files.
 */
export async function applySnapshot(
  root: FileSystemDirectoryHandle,
  snapshot: LocalSnapshot,
): Promise<void> {
  await writeQuestions(root, Array.isArray(snapshot.questions) ? snapshot.questions : []);
  const sessions = Array.isArray(snapshot.sessions) ? snapshot.sessions : [];
  for (const session of sessions) {
    if (!session?.sessionId) continue;
    await writeSessionMetadata(root, session.sessionId, session);
  }
}

export async function loadBackupMeta(root: FileSystemDirectoryHandle): Promise<BackupMeta | null> {
  return readBackupMeta(root);
}

export async function saveBackupMeta(
  root: FileSystemDirectoryHandle,
  meta: BackupMeta,
): Promise<void> {
  await writeBackupMeta(root, meta);
}
