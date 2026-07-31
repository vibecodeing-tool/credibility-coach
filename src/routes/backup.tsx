import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Check, CloudDownload, CloudUpload, Copy, RefreshCw, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useFsRoot } from "@/hooks/use-fs-root";
import {
  applySnapshot,
  collectSnapshot,
  loadBackupMeta,
  saveBackupMeta,
  type BackupMeta,
  type LocalSnapshot,
} from "@/lib/backup/snapshot";
import { createBackup, getBackup, updateBackup } from "@/lib/backup/backup.functions";
import { isValidBackupKey, normalizeBackupKey } from "@/lib/backup/keys";

export const Route = createFileRoute("/backup")({
  head: () => ({
    meta: [
      { title: "Cloud Backup — CAS Interview Trainer" },
      {
        name: "description",
        content:
          "Manually back up your local interview questions and session records to the cloud, then restore them on another device with a backup key.",
      },
      { property: "og:title", content: "Cloud Backup — CAS Interview Trainer" },
      {
        property: "og:description",
        content:
          "Manual, local-first cloud backup and restore for your interview questions and session history.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BackupPage,
});

function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString();
}

type PendingLoad = {
  cloud: {
    backupKey: string;
    updatedAt: string;
    createdAt: string;
    data: LocalSnapshot;
  };
  olderThanLocal: boolean;
};

type PendingConflict = {
  cloudUpdatedAt: string;
  cloudCounts: { questions: number; sessions: number };
};

function BackupPage() {
  const { handle, permission } = useFsRoot();
  const create = useServerFn(createBackup);
  const update = useServerFn(updateBackup);
  const fetchBackup = useServerFn(getBackup);

  const [snapshot, setSnapshot] = useState<LocalSnapshot | null>(null);
  const [meta, setMeta] = useState<BackupMeta | null>(null);
  const [busy, setBusy] = useState<null | "upload" | "update" | "load" | "apply">(null);
  const [copied, setCopied] = useState(false);
  const [keyInput, setKeyInput] = useState("");
  const [pendingLoad, setPendingLoad] = useState<PendingLoad | null>(null);
  const [pendingConflict, setPendingConflict] = useState<PendingConflict | null>(null);

  const refreshLocal = useCallback(async () => {
    if (!handle || permission !== "granted") return;
    const [snap, storedMeta] = await Promise.all([collectSnapshot(handle), loadBackupMeta(handle)]);
    setSnapshot(snap);
    setMeta(storedMeta);
  }, [handle, permission]);

  useEffect(() => {
    refreshLocal().catch((e) => toast.error((e as Error).message));
  }, [refreshLocal]);

  const doUpload = async () => {
    if (!handle) return;
    setBusy("upload");
    try {
      const snap = await collectSnapshot(handle);
      const res = await create({ data: { data: snap } });
      const next = { backupKey: res.backupKey, updatedAt: res.updatedAt };
      await saveBackupMeta(handle, next);
      setMeta(next);
      setSnapshot(snap);
      toast.success("Backup uploaded — save your backup key.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const doUpdate = async (force = false) => {
    if (!handle || !meta) return;
    setBusy("update");
    try {
      const snap = await collectSnapshot(handle);
      const res = await update({
        data: {
          backupKey: meta.backupKey,
          data: snap,
          knownUpdatedAt: meta.updatedAt,
          force,
        },
      });
      if ("notFound" in res && res.notFound) {
        toast.error("That backup key no longer exists in the cloud.");
        return;
      }
      if ("conflict" in res && res.conflict) {
        setPendingConflict({ cloudUpdatedAt: res.cloudUpdatedAt, cloudCounts: res.cloudCounts });
        return;
      }
      const next = { backupKey: meta.backupKey, updatedAt: res.updatedAt! };
      await saveBackupMeta(handle, next);
      setMeta(next);
      setSnapshot(snap);
      setPendingConflict(null);
      toast.success("Cloud backup updated.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const doFetch = async () => {
    if (!handle) return;
    const key = normalizeBackupKey(keyInput);
    if (!isValidBackupKey(key)) {
      toast.error("That doesn't look like a valid backup key.");
      return;
    }
    setBusy("load");
    try {
      const res = await fetchBackup({ data: { backupKey: key } });
      if ("notFound" in res && res.notFound) {
        toast.error("No backup found for that key.");
        return;
      }
      const cloud = res as Exclude<typeof res, { notFound: true }>;
      setPendingLoad({
        cloud: {
          backupKey: cloud.backupKey,
          updatedAt: cloud.updatedAt,
          createdAt: cloud.createdAt,
          data: cloud.data as LocalSnapshot,
        },
        olderThanLocal: meta ? Date.parse(cloud.updatedAt) < Date.parse(meta.updatedAt) : false,
      });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const confirmLoad = async () => {
    if (!handle || !pendingLoad) return;
    setBusy("apply");
    try {
      await applySnapshot(handle, pendingLoad.cloud.data);
      const next = {
        backupKey: pendingLoad.cloud.backupKey,
        updatedAt: pendingLoad.cloud.updatedAt,
      };
      await saveBackupMeta(handle, next);
      setMeta(next);
      setPendingLoad(null);
      setKeyInput("");
      await refreshLocal();
      toast.success("Local data replaced with the cloud backup.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const copyKey = async () => {
    if (!meta) return;
    await navigator.clipboard.writeText(meta.backupKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 p-4 md:p-8">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight">Cloud Backup</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your local folder stays the source of truth. Nothing is uploaded or downloaded unless you
          press a button here. Recordings stay on this device — backups cover questions and session
          records only.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">This device</CardTitle>
          <CardDescription>
            {snapshot
              ? `${snapshot.questions.length} question(s) · ${snapshot.sessions.length} session record(s)`
              : "Reading your local folder…"}
          </CardDescription>
        </CardHeader>
        {meta && (
          <CardContent className="space-y-2">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
              Backup key
            </Label>
            <div className="flex items-center gap-2">
              <code className="flex-1 truncate rounded-md border bg-muted/40 px-3 py-2 font-mono text-sm">
                {meta.backupKey}
              </code>
              <Button size="icon" variant="outline" onClick={copyKey} aria-label="Copy backup key">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Last uploaded from this device: {fmtDate(meta.updatedAt)}
            </p>
          </CardContent>
        )}
        <CardFooter className="flex flex-wrap gap-2">
          <Button onClick={doUpload} disabled={!handle || busy !== null}>
            {busy === "upload" ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <CloudUpload className="mr-2 h-4 w-4" />
            )}
            Upload new backup
          </Button>
          <Button variant="outline" onClick={() => doUpdate(false)} disabled={!meta || busy !== null}>
            {busy === "update" ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Update backup
          </Button>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Load a backup</CardTitle>
          <CardDescription>
            Enter a backup key from another device. You'll be asked to confirm before anything local
            is replaced.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Label htmlFor="backup-key">Backup key</Label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              id="backup-key"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              placeholder="CAS-XXXXXXXXXXXXXXXXXXXX"
              className="font-mono"
            />
            <Button
              variant="outline"
              onClick={doFetch}
              disabled={!handle || busy !== null || keyInput.trim().length === 0}
            >
              {busy === "load" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CloudDownload className="mr-2 h-4 w-4" />
              )}
              Load backup
            </Button>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={pendingLoad !== null} onOpenChange={(o) => !o && setPendingLoad(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Replace local data with this backup?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <div>
                  Cloud copy: {pendingLoad?.cloud.data.questions?.length ?? 0} question(s) ·{" "}
                  {pendingLoad?.cloud.data.sessions?.length ?? 0} session record(s), last updated{" "}
                  {fmtDate(pendingLoad?.cloud.updatedAt)}.
                </div>
                <div>
                  This device: {snapshot?.questions.length ?? 0} question(s) ·{" "}
                  {snapshot?.sessions.length ?? 0} session record(s).
                </div>
                <div>
                  Your local questions will be replaced and session records will be restored from
                  the backup. Existing recordings on this device are kept.
                </div>
                {pendingLoad?.olderThanLocal && (
                  <div className="font-medium text-destructive">
                    Warning: this cloud backup is older than the data you last uploaded from this
                    device.
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmLoad} disabled={busy === "apply"}>
              Replace local data
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={pendingConflict !== null}
        onOpenChange={(o) => !o && setPendingConflict(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cloud backup is newer</AlertDialogTitle>
            <AlertDialogDescription>
              The cloud copy was updated {fmtDate(pendingConflict?.cloudUpdatedAt)} (
              {pendingConflict?.cloudCounts.questions ?? 0} question(s) ·{" "}
              {pendingConflict?.cloudCounts.sessions ?? 0} session record(s)) — probably from another
              device. Overwriting it will discard those changes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep cloud version</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setPendingConflict(null);
                void doUpdate(true);
              }}
            >
              Overwrite anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
