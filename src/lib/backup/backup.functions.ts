import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { generateBackupKey, isValidBackupKey } from "./keys";

const snapshotSchema = z.object({
  questions: z.array(z.unknown()),
  sessions: z.array(z.unknown()),
  settings: z.record(z.unknown()).optional(),
});

const keySchema = z.string().refine(isValidBackupKey, "Invalid backup key");

export const createBackup = createServerFn({ method: "POST" })
  .inputValidator(z.object({ data: snapshotSchema }))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Retry a couple of times in the (astronomically unlikely) case of collision.
    for (let attempt = 0; attempt < 3; attempt++) {
      const backupKey = generateBackupKey();
      const { data: row, error } = await supabaseAdmin
        .from("backups")
        .insert({ backup_key: backupKey, data: data.data, version: 1 })
        .select("backup_key, created_at, updated_at, version")
        .single();
      if (!error && row) {
        return { backupKey: row.backup_key, updatedAt: row.updated_at, version: row.version };
      }
      if (error && error.code !== "23505") throw new Error(error.message);
    }
    throw new Error("Could not generate a unique backup key. Please try again.");
  });

export const updateBackup = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      backupKey: keySchema,
      data: snapshotSchema,
      knownUpdatedAt: z.string().nullable().optional(),
      force: z.boolean().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing, error: readError } = await supabaseAdmin
      .from("backups")
      .select("backup_key, updated_at, version, data")
      .eq("backup_key", data.backupKey)
      .maybeSingle();
    if (readError) throw new Error(readError.message);
    if (!existing) return { notFound: true as const };

    // Conflict prevention: refuse to clobber a cloud copy that is newer than
    // the one this device last uploaded, unless the user explicitly forces it.
    if (!data.force) {
      const known = data.knownUpdatedAt ? Date.parse(data.knownUpdatedAt) : 0;
      if (Date.parse(existing.updated_at) > known) {
        const cloudData = existing.data as { questions?: unknown[]; sessions?: unknown[] } | null;
        return {
          conflict: true as const,
          cloudUpdatedAt: existing.updated_at,
          cloudCounts: {
            questions: cloudData?.questions?.length ?? 0,
            sessions: cloudData?.sessions?.length ?? 0,
          },
        };
      }
    }

    const { data: row, error } = await supabaseAdmin
      .from("backups")
      .update({
        data: data.data,
        updated_at: new Date().toISOString(),
        version: (existing.version ?? 1) + 1,
      })
      .eq("backup_key", data.backupKey)
      .select("backup_key, updated_at, version")
      .single();
    if (error) throw new Error(error.message);
    return { backupKey: row.backup_key, updatedAt: row.updated_at, version: row.version };
  });

export const getBackup = createServerFn({ method: "POST" })
  .inputValidator(z.object({ backupKey: keySchema }))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("backups")
      .select("backup_key, version, data, created_at, updated_at")
      .eq("backup_key", data.backupKey)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) return { notFound: true as const };
    return {
      backupKey: row.backup_key,
      version: row.version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      data: row.data as { questions: unknown[]; sessions: unknown[]; settings?: unknown },
    };
  });
