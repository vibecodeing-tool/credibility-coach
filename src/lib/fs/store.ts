import type { Question, SessionMetadata } from "@/lib/types";

// ---------- generic helpers ----------

async function writeJSON(dir: FileSystemDirectoryHandle, name: string, data: unknown): Promise<void> {
  const fh = await dir.getFileHandle(name, { create: true });
  const ws = await fh.createWritable();
  await ws.write(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
  await ws.close();
}

async function readJSON<T>(dir: FileSystemDirectoryHandle, name: string): Promise<T | null> {
  try {
    const fh = await dir.getFileHandle(name);
    const file = await fh.getFile();
    const text = await file.text();
    return JSON.parse(text) as T;
  } catch (err) {
    if ((err as DOMException).name === "NotFoundError") return null;
    throw err;
  }
}

export async function writeBlob(
  dir: FileSystemDirectoryHandle,
  name: string,
  blob: Blob,
): Promise<void> {
  const fh = await dir.getFileHandle(name, { create: true });
  const ws = await fh.createWritable();
  await ws.write(blob);
  await ws.close();
}

async function getSessionsDir(root: FileSystemDirectoryHandle): Promise<FileSystemDirectoryHandle> {
  return root.getDirectoryHandle("sessions", { create: true });
}

// ---------- questions.json ----------

export async function readQuestions(root: FileSystemDirectoryHandle): Promise<Question[]> {
  const data = await readJSON<Question[]>(root, "questions.json");
  return Array.isArray(data) ? data : [];
}

export async function writeQuestions(
  root: FileSystemDirectoryHandle,
  questions: Question[],
): Promise<void> {
  await writeJSON(root, "questions.json", questions);
}

// ---------- sessions ----------

export async function listSessions(root: FileSystemDirectoryHandle): Promise<SessionMetadata[]> {
  const dir = await getSessionsDir(root);
  const out: SessionMetadata[] = [];
  // entries() is available on FileSystemDirectoryHandle but missing from older TS libs.
  const entries = (dir as unknown as {
    entries: () => AsyncIterable<[string, FileSystemHandle]>;
  }).entries();
  for await (const [, handle] of entries) {
    if (handle.kind !== "directory") continue;
    const meta = await readJSON<SessionMetadata>(handle as FileSystemDirectoryHandle, "metadata.json");
    if (meta) out.push(meta);
  }
  return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getSessionDir(
  root: FileSystemDirectoryHandle,
  sessionId: string,
  create = false,
): Promise<FileSystemDirectoryHandle> {
  const sessions = await getSessionsDir(root);
  return sessions.getDirectoryHandle(sessionId, { create });
}

export async function readSession(
  root: FileSystemDirectoryHandle,
  sessionId: string,
): Promise<SessionMetadata | null> {
  const dir = await getSessionDir(root, sessionId, false);
  return readJSON<SessionMetadata>(dir, "metadata.json");
}

export async function writeSessionMetadata(
  root: FileSystemDirectoryHandle,
  sessionId: string,
  meta: SessionMetadata,
): Promise<void> {
  const dir = await getSessionDir(root, sessionId, true);
  await writeJSON(dir, "metadata.json", meta);
}

export async function deleteSession(
  root: FileSystemDirectoryHandle,
  sessionId: string,
): Promise<void> {
  const sessions = await getSessionsDir(root);
  await (sessions as unknown as {
    removeEntry: (n: string, o?: { recursive?: boolean }) => Promise<void>;
  }).removeEntry(sessionId, { recursive: true });
}

export async function readSessionFile(
  root: FileSystemDirectoryHandle,
  sessionId: string,
  filename: string,
): Promise<File> {
  const dir = await getSessionDir(root, sessionId, false);
  const fh = await dir.getFileHandle(filename);
  return fh.getFile();
}
