// Backup keys are the only credential for a cloud backup, so they must be
// generated with a CSPRNG. Alphabet excludes look-alike chars (0/O/1/I).
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const KEY_LENGTH = 20;

export const BACKUP_KEY_PREFIX = "CAS-";

export function generateBackupKey(): string {
  const bytes = new Uint8Array(KEY_LENGTH);
  crypto.getRandomValues(bytes);
  let out = "";
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length];
  return BACKUP_KEY_PREFIX + out;
}

export function normalizeBackupKey(raw: string): string {
  const trimmed = raw.trim().toUpperCase().replace(/\s+/g, "");
  return trimmed.startsWith(BACKUP_KEY_PREFIX) ? trimmed : BACKUP_KEY_PREFIX + trimmed;
}

export function isValidBackupKey(key: string): boolean {
  return new RegExp(`^${BACKUP_KEY_PREFIX}[${ALPHABET}]{${KEY_LENGTH}}$`).test(key);
}
