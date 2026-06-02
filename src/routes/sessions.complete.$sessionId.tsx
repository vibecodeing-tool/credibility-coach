import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { useFsRoot } from "@/hooks/use-fs-root";
import { readSession } from "@/lib/fs/store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { SessionMetadata } from "@/lib/types";

export const Route = createFileRoute("/sessions/complete/$sessionId")({
  head: () => ({ meta: [{ title: "Interview complete" }] }),
  component: CompletePage,
});

function fmtDuration(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}m ${s}s`;
}

function CompletePage() {
  const { sessionId } = Route.useParams();
  const { handle } = useFsRoot();
  const [meta, setMeta] = useState<SessionMetadata | null>(null);

  useEffect(() => {
    if (!handle) return;
    readSession(handle, sessionId).then(setMeta);
  }, [handle, sessionId]);

  return (
    <div className="mx-auto w-full max-w-2xl p-4 md:p-8">
      <Card>
        <CardHeader className="text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-success/15 text-success">
            <CheckCircle2 className="h-7 w-7" />
          </div>
          <CardTitle className="font-display text-2xl">Interview complete</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {meta ? (
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Stat label="Session" value={meta.sessionName} />
              <Stat label="Date" value={new Date(meta.createdAt).toLocaleString()} />
              <Stat label="Questions" value={`${meta.questions.length} / ${meta.totalQuestions}`} />
              <Stat label="Duration" value={fmtDuration(meta.durationSeconds)} />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Loading…</p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button asChild variant="outline">
              <Link to="/sessions">Back to history</Link>
            </Button>
            <Button asChild>
              <Link to="/sessions/$sessionId" params={{ sessionId }}>
                Review recordings
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-muted/30 p-3">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 font-medium">{value}</div>
    </div>
  );
}
