import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { PlayCircle, ArrowRight } from "lucide-react";
import { useQuestions } from "@/hooks/use-questions";
import { useFsRoot } from "@/hooks/use-fs-root";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { sessionFolderName } from "@/lib/fs/filenames";
import { selectQuestions } from "@/lib/interview/selector";
import { writeSessionMetadata } from "@/lib/fs/store";
import type { SessionMetadata } from "@/lib/types";

export const Route = createFileRoute("/sessions/new")({
  head: () => ({ meta: [{ title: "New session — CAS Interview Simulator" }] }),
  component: NewSessionPage,
});

function NewSessionPage() {
  const { questions } = useQuestions();
  const { handle } = useFsRoot();
  const navigate = useNavigate();

  const [name, setName] = useState("CAS Mock Interview");
  const [mode, setMode] = useState<"sequential" | "random">("sequential");
  const [countMode, setCountMode] = useState<"all" | "custom">("all");
  const [customCount, setCustomCount] = useState(10);
  const [rangeStart, setRangeStart] = useState(1);
  const [rangeEnd, setRangeEnd] = useState<number>(0);
  const [transitionMode, setTransitionMode] = useState<"manual" | "automatic">("manual");
  const [starting, setStarting] = useState(false);

  // Initialize range end when questions load.
  const effectiveRangeEnd = rangeEnd > 0 ? rangeEnd : questions.length;

  const preview = useMemo(
    () =>
      selectQuestions(questions, {
        mode,
        count: countMode === "all" ? "all" : customCount,
        rangeStart,
        rangeEnd: effectiveRangeEnd,
      }),
    [questions, mode, countMode, customCount, rangeStart, effectiveRangeEnd],
  );

  const totalSeconds = preview.reduce((s, q) => s + q.readingTime + q.answerTime, 0);

  const handleStart = async () => {
    if (!handle) return;
    if (!name.trim()) {
      toast.error("Session name is required");
      return;
    }
    if (preview.length === 0) {
      toast.error("No questions selected");
      return;
    }
    setStarting(true);
    try {
      const date = new Date();
      const sessionId = sessionFolderName(name, date);
      const meta: SessionMetadata = {
        sessionId,
        sessionName: name.trim(),
        createdAt: date.toISOString(),
        completed: false,
        totalQuestions: preview.length,
        durationSeconds: 0,
        questions: [],
        config: {
          mode,
          count: countMode === "all" ? "all" : customCount,
          rangeStart,
          rangeEnd: effectiveRangeEnd,
          transitionMode,
        },
      };
      await writeSessionMetadata(handle, sessionId, meta);
      // Stash the planned question order in sessionStorage so the runner uses
      // the exact selection (especially for random mode).
      sessionStorage.setItem(
        `cas:plan:${sessionId}`,
        JSON.stringify({
          transitionMode,
          questions: preview.map((q) => ({
            id: q.id,
            question: q.question,
            answer: q.answer,
            readingTime: q.readingTime,
            answerTime: q.answerTime,
          })),
        }),
      );
      navigate({ to: "/sessions/run/$sessionId", params: { sessionId } });
    } catch (e) {
      toast.error("Failed to create session: " + (e as Error).message);
      setStarting(false);
    }
  };

  if (questions.length === 0) {
    return (
      <div className="mx-auto w-full max-w-2xl p-4 md:p-8">
        <Card>
          <CardHeader>
            <CardTitle>No questions yet</CardTitle>
            <CardDescription>
              Add some questions before starting a mock interview.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link to="/questions">Go to questions</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 p-4 md:p-8">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight">New session</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure your mock interview. Once you start, CAS mode locks the flow until completion.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Session</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="s-name">Session name</Label>
            <Input id="s-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Question selection</CardTitle>
          <CardDescription>Combine mode, count and range freely.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>Mode</Label>
            <RadioGroup
              value={mode}
              onValueChange={(v) => setMode(v as "sequential" | "random")}
              className="grid gap-2 sm:grid-cols-2"
            >
              <label className="flex cursor-pointer items-center gap-3 rounded-md border p-3 has-[:checked]:border-primary has-[:checked]:bg-accent/40">
                <RadioGroupItem value="sequential" />
                <div>
                  <div className="text-sm font-medium">Sequential</div>
                  <div className="text-xs text-muted-foreground">In list order</div>
                </div>
              </label>
              <label className="flex cursor-pointer items-center gap-3 rounded-md border p-3 has-[:checked]:border-primary has-[:checked]:bg-accent/40">
                <RadioGroupItem value="random" />
                <div>
                  <div className="text-sm font-medium">Random</div>
                  <div className="text-xs text-muted-foreground">Shuffled within range</div>
                </div>
              </label>
            </RadioGroup>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>How many?</Label>
              <Select value={countMode} onValueChange={(v) => setCountMode(v as "all" | "custom")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All questions in range</SelectItem>
                  <SelectItem value="custom">Custom number</SelectItem>
                </SelectContent>
              </Select>
              {countMode === "custom" && (
                <Input
                  type="number"
                  min={1}
                  value={customCount}
                  onChange={(e) => setCustomCount(Math.max(1, Number(e.target.value) || 1))}
                />
              )}
            </div>
            <div className="space-y-2">
              <Label>
                Question range (of {questions.length})
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  max={questions.length}
                  value={rangeStart}
                  onChange={(e) => setRangeStart(Math.max(1, Number(e.target.value) || 1))}
                />
                <span className="text-muted-foreground">—</span>
                <Input
                  type="number"
                  min={1}
                  max={questions.length}
                  value={effectiveRangeEnd}
                  onChange={(e) => setRangeEnd(Math.max(1, Number(e.target.value) || 1))}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Interview settings</CardTitle>
          <CardDescription>Choose how questions advance during the interview.</CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={transitionMode}
            onValueChange={(v) => setTransitionMode(v as "manual" | "automatic")}
            className="grid gap-2 sm:grid-cols-2"
          >
            <label className="flex cursor-pointer items-start gap-3 rounded-md border p-3 has-[:checked]:border-primary has-[:checked]:bg-accent/40">
              <RadioGroupItem value="manual" className="mt-0.5" />
              <div>
                <div className="text-sm font-medium">Manual (recommended)</div>
                <div className="text-xs text-muted-foreground">
                  Pause after each answer; click Next question to continue.
                </div>
              </div>
            </label>
            <label className="flex cursor-pointer items-start gap-3 rounded-md border p-3 has-[:checked]:border-primary has-[:checked]:bg-accent/40">
              <RadioGroupItem value="automatic" className="mt-0.5" />
              <div>
                <div className="text-sm font-medium">Automatic</div>
                <div className="text-xs text-muted-foreground">
                  Move to the next question as soon as the recording is saved.
                </div>
              </div>
            </label>
          </RadioGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Summary</CardTitle>
          <CardDescription>Confirm before starting.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{preview.length} questions</Badge>
            <Badge variant="secondary">Mode: {mode}</Badge>
            <Badge variant="secondary">
              Range {rangeStart}–{effectiveRangeEnd}
            </Badge>
            <Badge variant="secondary">~{Math.ceil(totalSeconds / 60)} min</Badge>
          </div>
          {preview.length > 0 && (
            <ol className="max-h-48 list-decimal space-y-1 overflow-auto rounded-md border bg-muted/30 p-3 pl-7 text-sm">
              {preview.map((q) => (
                <li key={q.id} className="truncate">
                  {q.question}
                </li>
              ))}
            </ol>
          )}
          <div className="flex justify-end pt-2">
            <Button size="lg" onClick={handleStart} disabled={starting || preview.length === 0}>
              <PlayCircle className="mr-2 h-4 w-4" />
              Start interview
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
