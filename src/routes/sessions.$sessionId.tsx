import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Download, ChevronLeft } from "lucide-react";
import { useFsRoot } from "@/hooks/use-fs-root";
import { readSession, readSessionFile } from "@/lib/fs/store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { SessionMetadata } from "@/lib/types";

export const Route = createFileRoute("/sessions/$sessionId")({
  head: () => ({ meta: [{ title: "Review session" }] }),
  component: ReviewSession,
});

function ReviewSession() {
  const { sessionId } = Route.useParams();
  const { handle, permission } = useFsRoot();
  const [meta, setMeta] = useState<SessionMetadata | null>(null);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!handle || permission !== "granted") return;
    let alive = true;
    const created: string[] = [];
    (async () => {
      try {
        const m = await readSession(handle, sessionId);
        if (!alive) return;
        if (!m) {
          setError("Session not found.");
          return;
        }
        setMeta(m);
        const map: Record<string, string> = {};
        for (const q of m.questions) {
          try {
            const file = await readSessionFile(handle, sessionId, q.videoFile);
            const url = URL.createObjectURL(file);
            created.push(url);
            map[q.videoFile] = url;
          } catch {
            /* ignore missing file */
          }
        }
        if (alive) setUrls(map);
      } catch (e) {
        setError((e as Error).message);
      }
    })();
    return () => {
      alive = false;
      created.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [handle, permission, sessionId]);

  const download = async (filename: string) => {
    if (!handle) return;
    const file = await readSessionFile(handle, sessionId, filename);
    const url = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  if (error) {
    return (
      <div className="p-8">
        <p className="text-sm text-destructive">{error}</p>
      </div>
    );
  }

  if (!meta) {
    return <div className="p-8 text-sm text-muted-foreground">Loading…</div>;
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 p-4 md:p-8">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link to="/sessions">
            <ChevronLeft className="mr-1 h-4 w-4" /> All sessions
          </Link>
        </Button>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">
          {meta.sessionName}
        </h1>
        <div className="mt-2 flex flex-wrap gap-2 text-xs">
          <Badge variant={meta.completed ? "default" : "outline"}>
            {meta.completed ? "Completed" : "Incomplete"}
          </Badge>
          <Badge variant="secondary">{new Date(meta.createdAt).toLocaleString()}</Badge>
          <Badge variant="secondary">
            {meta.questions.length}/{meta.totalQuestions} answers
          </Badge>
        </div>
      </div>

      {meta.questions.length === 0 ? (
        <Card className="p-10 text-center">
          <p className="text-sm text-muted-foreground">No recordings yet.</p>
        </Card>
      ) : (
        <div className="grid gap-4">
          {meta.questions.map((q, i) => (
            <Card key={q.videoFile}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-medium">
                  <span className="mr-2 font-mono text-muted-foreground">Q{i + 1}</span>
                  {q.questionText}
                </CardTitle>
                {q.displayedQuestion && q.displayedQuestion !== q.questionText && (
                  <p className="text-sm italic text-muted-foreground">
                    <span className="font-medium not-italic">Asked as:</span> "{q.displayedQuestion}"
                  </p>
                )}
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <span>Recorded {q.recordingDuration}s</span>
                  <span>·</span>
                  <span className="font-mono">{q.videoFile}</span>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid gap-4 md:grid-cols-2">
                  {urls[q.videoFile] ? (
                    <video
                      src={urls[q.videoFile]}
                      controls
                      className="aspect-video w-full rounded-md bg-black"
                    />
                  ) : (
                    <div className="grid aspect-video w-full place-items-center rounded-md bg-muted text-sm text-muted-foreground">
                      Recording unavailable
                    </div>
                  )}
                  <div className="flex flex-col">
                    <div className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Reference answer
                    </div>
                    {q.answer?.trim() ? (
                      <div className="flex-1 whitespace-pre-wrap rounded-md border bg-muted/30 p-3 text-sm leading-relaxed">
                        {q.answer}
                      </div>
                    ) : (
                      <div className="flex flex-1 items-center justify-center rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                        No reference answer was saved for this question.
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button size="sm" variant="outline" onClick={() => download(q.videoFile)}>
                    <Download className="mr-2 h-4 w-4" /> Download .webm
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
