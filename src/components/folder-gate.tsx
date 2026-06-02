import { useEffect, useState, type ReactNode } from "react";
import { AlertTriangle, FolderOpen, ShieldCheck } from "lucide-react";
import { useFsRoot } from "@/hooks/use-fs-root";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Gates the app behind a chosen data folder.
 * - Server-renders a neutral shell (no browser APIs touched).
 * - On the client, shows folder picker / permission re-grant flow.
 */
export function FolderGate({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const { supported, ready, handle, permission, pickFolder, requestAccess } = useFsRoot();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!mounted || !ready) {
    return (
      <div className="grid min-h-[60vh] place-items-center p-8 text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (!supported) {
    return (
      <div className="grid min-h-[60vh] place-items-center p-6">
        <Card className="max-w-lg">
          <CardHeader>
            <div className="flex items-center gap-2 text-recording">
              <AlertTriangle className="h-5 w-5" />
              <CardTitle>Browser not supported</CardTitle>
            </div>
            <CardDescription>
              This app stores your interview data as real files on your machine using the
              File System Access API. That API is available in Chromium-based desktop
              browsers (Chrome, Edge, Arc, Brave, Opera). Please reopen this app in one of
              those to continue.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (!handle) {
    return (
      <div className="grid min-h-[60vh] place-items-center p-6">
        <Card className="max-w-xl">
          <CardHeader>
            <div className="flex items-center gap-2">
              <FolderOpen className="h-5 w-5 text-primary" />
              <CardTitle>Choose your data folder</CardTitle>
            </div>
            <CardDescription>
              Pick (or create) a folder named something like{" "}
              <span className="font-mono">CAS-Interview</span>. All questions, sessions, and
              <span className="font-mono"> .webm </span>recordings will be written directly
              into this folder — readable from your file explorer at any time.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {error && (
              <p className="rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">
                {error}
              </p>
            )}
            <Button
              disabled={busy}
              onClick={async () => {
                setError(null);
                setBusy(true);
                try {
                  await pickFolder();
                } catch (e) {
                  const msg = (e as Error).message;
                  if (!/abort/i.test(msg)) setError(msg);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <FolderOpen className="mr-2 h-4 w-4" />
              {busy ? "Opening…" : "Choose folder"}
            </Button>
            <p className="text-xs text-muted-foreground">
              Nothing leaves your device. No backend, no database, no cloud storage.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (permission !== "granted") {
    return (
      <div className="grid min-h-[60vh] place-items-center p-6">
        <Card className="max-w-xl">
          <CardHeader>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              <CardTitle>Reconnect to your folder</CardTitle>
            </div>
            <CardDescription>
              Your browser needs permission to access{" "}
              <span className="font-mono">{handle.name}</span> again.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Button
              onClick={async () => {
                setBusy(true);
                try {
                  await requestAccess();
                } finally {
                  setBusy(false);
                }
              }}
              disabled={busy}
            >
              Grant access
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
