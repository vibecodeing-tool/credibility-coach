export function sanitizeFilename(s: string): string {
  const cleaned = s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
  return cleaned || "untitled";
}

export function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function sessionFolderName(name: string, date: Date): string {
  const safe = sanitizeFilename(name);
  const y = date.getFullYear();
  const mo = pad2(date.getMonth() + 1);
  const d = pad2(date.getDate());
  const h = pad2(date.getHours());
  const mi = pad2(date.getMinutes());
  return `${safe}_${y}-${mo}-${d}_${h}-${mi}`;
}

export function answerFilename(index: number, questionText: string): string {
  return `${pad2(index + 1)}_${sanitizeFilename(questionText)}.webm`;
}
