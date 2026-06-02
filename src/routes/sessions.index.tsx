import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Trash2, ArrowRight, Video } from "lucide-react";
import { useSessions } from "@/hooks/use-sessions";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

export const Route = createFileRoute("/sessions/")({
  head: () => ({ meta: [{ title: "Session history" }] }),
  component: SessionsPage,
});

function fmtDuration(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}m ${s}s`;
}

function SessionsPage() {
  const { sessions, loading, remove } = useSessions();
  const [deleting, setDeleting] = useState<string | null>(null);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 p-4 md:p-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Session history</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Each session is a folder in your data folder.
          </p>
        </div>
        <Button asChild>
          <Link to="/sessions/new">New session</Link>
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : sessions.length === 0 ? (
        <Card className="p-10 text-center">
          <p className="text-sm text-muted-foreground">No sessions yet.</p>
        </Card>
      ) : (
        <div className="grid gap-3">
          {sessions.map((s) => (
            <Card key={s.sessionId} className="p-4">
              <div className="flex flex-wrap items-center gap-4">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-accent text-accent-foreground">
                  <Video className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{s.sessionName}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {new Date(s.createdAt).toLocaleString()} ·{" "}
                    <span className="font-mono">{s.sessionId}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Badge variant={s.completed ? "default" : "outline"}>
                      {s.completed ? "Completed" : "Incomplete"}
                    </Badge>
                    <Badge variant="secondary">
                      {s.questions.length}/{s.totalQuestions} answers
                    </Badge>
                    <Badge variant="secondary">{fmtDuration(s.durationSeconds)}</Badge>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button asChild variant="ghost" size="sm">
                    <Link to="/sessions/$sessionId" params={{ sessionId: s.sessionId }}>
                      Open <ArrowRight className="ml-1 h-4 w-4" />
                    </Link>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setDeleting(s.sessionId)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this session?</AlertDialogTitle>
            <AlertDialogDescription>
              The session folder and all recordings inside it will be permanently removed from
              your disk.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (deleting) {
                  try {
                    await remove(deleting);
                    toast.success("Session deleted");
                  } catch (e) {
                    toast.error("Failed: " + (e as Error).message);
                  }
                }
                setDeleting(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
