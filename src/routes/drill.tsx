import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Timer, Mic, Square, RotateCcw, Play, CircleDot, Check, ChevronsUpDown, Search } from "lucide-react";
import { z } from "zod";
import { useQuestions } from "@/hooks/use-questions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import type { Question } from "@/lib/types";

const searchSchema = z.object({
  questionId: z.string().optional(),
  mode: z.enum(["auto", "free", "timed"]).optional(),
});

export const Route = createFileRoute("/drill")({
  head: () => ({ meta: [{ title: "Speaking Drill — Quick Practice" }] }),
  validateSearch: searchSchema,
  component: DrillPage,
});

type Phase = "select" | "recording" | "playback";
type DrillMode = "auto" | "free" | "timed";

function pickMime(): string {
  const types = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ];
  if (typeof MediaRecorder === "undefined") return "";
  for (const t of types) {
    if (MediaRecorder.isTypeSupported(t)) return t;
  }
  return "";
}

function formatTime(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60).toString().padStart(2, "0");
  const s = (total % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function DrillPage() {
  const { questions, loading } = useQuestions();
  const navigate = useNavigate();
  const search = Route.useSearch();

  const [questionId, setQuestionId] = useState<string>(search.questionId ?? "");
  const [mode, setMode] = useState<DrillMode>(search.mode ?? "auto");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("select");
  const [elapsedMs, setElapsedMs] = useState(0);
  const [finalMs, setFinalMs] = useState(0);
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [autoStopped, setAutoStopped] = useState(false);

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const videoRef = useRef<HTMLVideoElement>(null);
  const tickRef = useRef<number | null>(null);
  const startedAtRef = useRef<number>(0);
  const urlRef = useRef<string | null>(null);
  const autoStopAtRef = useRef<number | null>(null);

  const question: Question | undefined = questions.find((q) => q.id === questionId);
  const hasTarget = !!(question?.answerTime && question.answerTime > 0);

  // Sync URL questionId → state when navigated to /drill?questionId=...
  useEffect(() => {
    if (search.questionId && search.questionId !== questionId) {
      setQuestionId(search.questionId);
    }
    if (search.mode && search.mode !== mode) {
      setMode(search.mode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.questionId, search.mode]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopStream();
      if (tickRef.current) window.clearInterval(tickRef.current);
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    };
  }, []);

  useEffect(() => {
    if (phase === "recording" && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [phase]);

  function stopStream() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  function clearRecording() {
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
    setPlaybackUrl(null);
    chunksRef.current = [];
    setFinalMs(0);
    setElapsedMs(0);
    setAutoStopped(false);
  }

  // Whether auto-stop applies for current mode + question
  function shouldAutoStop(): boolean {
    if (mode === "free") return false;
    if (mode === "timed") return hasTarget;
    // auto
    return hasTarget;
  }

  async function startPractice() {
    if (!question) return;
    setError(null);
    clearRecording();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true,
      });
      streamRef.current = stream;
      const mime = pickMime();
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      recorderRef.current = rec;
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mime || "video/webm" });
        const url = URL.createObjectURL(blob);
        urlRef.current = url;
        setPlaybackUrl(url);
        stopStream();
        setPhase("playback");
      };
      rec.start(1000);
      startedAtRef.current = Date.now();
      autoStopAtRef.current = shouldAutoStop() && question.answerTime
        ? startedAtRef.current + question.answerTime * 1000
        : null;
      setElapsedMs(0);
      tickRef.current = window.setInterval(() => {
        const now = Date.now();
        setElapsedMs(now - startedAtRef.current);
        if (autoStopAtRef.current && now >= autoStopAtRef.current) {
          setAutoStopped(true);
          stopRecording();
        }
      }, 100);
      setPhase("recording");
    } catch (e) {
      setError("Camera/microphone access denied: " + (e as Error).message);
      stopStream();
    }
  }

  function stopRecording() {
    if (tickRef.current) {
      window.clearInterval(tickRef.current);
      tickRef.current = null;
    }
    const ms = Date.now() - startedAtRef.current;
    setFinalMs(ms);
    setElapsedMs(ms);
    try {
      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        recorderRef.current.stop();
      }
    } catch {
      /* noop */
    }
  }

  function cancelRecording() {
    if (tickRef.current) {
      window.clearInterval(tickRef.current);
      tickRef.current = null;
    }
    try {
      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        recorderRef.current.onstop = null;
        recorderRef.current.stop();
      }
    } catch {
      /* noop */
    }
    stopStream();
    clearRecording();
    setPhase("select");
  }

  function retry() {
    clearRecording();
    startPractice();
  }

  function pickDifferent() {
    clearRecording();
    setQuestionId("");
    navigate({ to: "/drill", search: { mode } });
    setPhase("select");
    setPickerOpen(true);
  }

  const targetSec = question?.answerTime;
  const attemptSec = Math.round(finalMs / 1000);
  const delta = targetSec ? attemptSec - targetSec : 0;
  const remainingMs = autoStopAtRef.current && phase === "recording"
    ? Math.max(0, autoStopAtRef.current - (startedAtRef.current + elapsedMs))
    : null;

  const modeBehavior = useMemo(() => {
    if (mode === "free") return "Never auto-stops. Stop manually whenever you're done.";
    if (mode === "timed") return hasTarget
      ? `Strict exam mode — auto-stops at ${targetSec}s.`
      : "No target time on this question — behaves like Free mode.";
    return hasTarget
      ? `Smart mode — auto-stops at ${targetSec}s.`
      : "Smart mode — no target time, so this behaves like Free.";
  }, [mode, hasTarget, targetSec]);

  return (
    <div className="container mx-auto max-w-4xl space-y-6 px-4 py-6">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Timer className="h-5 w-5 text-primary" />
          <h1 className="font-display text-2xl font-semibold">Speaking Drill</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Quick single-question practice. Recordings are temporary — nothing is saved to your folder.
        </p>
      </div>

      {error && (
        <Card className="border-destructive/50">
          <CardContent className="pt-6 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      {phase === "select" && (
        <Card>
          <CardHeader>
            <CardTitle>Pick a question</CardTitle>
            <CardDescription>
              {loading
                ? "Loading questions…"
                : questions.length === 0
                  ? "Add questions in the Questions page first."
                  : "Search and choose one question to drill."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Mode selector */}
            <div className="space-y-1.5">
              <Label>Practice mode</Label>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Select value={mode} onValueChange={(v) => setMode(v as DrillMode)}>
                  <SelectTrigger className="sm:w-64">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">🟡 AUTO — Smart Mode</SelectItem>
                    <SelectItem value="free">🟢 FREE — Fluency Mode</SelectItem>
                    <SelectItem value="timed">🔴 TIMED — Exam Mode</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">{modeBehavior}</p>
              </div>
            </div>

            {/* Searchable question picker */}
            <div className="space-y-1.5">
              <Label>Question</Label>
              <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={pickerOpen}
                    className="w-full justify-between font-normal"
                  >
                    <span className="line-clamp-1 text-left">
                      {question ? question.question : "Search and select a question…"}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                  <Command
                    filter={(value, search) => {
                      const q = questions.find((x) => x.id === value);
                      const hay = (q?.question ?? "") + " " + (q?.category ?? "");
                      return hay.toLowerCase().includes(search.toLowerCase()) ? 1 : 0;
                    }}
                  >
                    <CommandInput placeholder="Search questions…" />
                    <CommandList>
                      <CommandEmpty>No questions found.</CommandEmpty>
                      <CommandGroup>
                        {questions.map((q) => (
                          <CommandItem
                            key={q.id}
                            value={q.id}
                            onSelect={(v) => {
                              setQuestionId(v);
                              setPickerOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                questionId === q.id ? "opacity-100" : "opacity-0",
                              )}
                            />
                            <div className="min-w-0 flex-1">
                              <div className="line-clamp-2 text-sm">{q.question}</div>
                              <div className="mt-0.5 flex gap-1.5 text-[10px] text-muted-foreground">
                                {q.category && <span>{q.category}</span>}
                                {q.answerTime ? <span>• Target {q.answerTime}s</span> : <span>• No target</span>}
                              </div>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {question && (
              <div className="rounded-md border bg-muted/30 p-4 space-y-3">
                <p className="font-medium leading-snug break-words">{question.question}</p>
                <div className="flex flex-wrap items-center gap-2">
                  {question.category && <Badge variant="secondary">{question.category}</Badge>}
                  {hasTarget ? (
                    <Badge variant="outline">Target: {question.answerTime}s</Badge>
                  ) : (
                    <Badge variant="outline">No target time</Badge>
                  )}
                  <Badge>{mode === "auto" ? "AUTO" : mode === "free" ? "FREE" : "TIMED"}</Badge>
                </div>
              </div>
            )}

            <Button
              size="lg"
              disabled={!question}
              onClick={startPractice}
              className="w-full sm:w-auto"
            >
              <Mic className="mr-2 h-4 w-4" />
              Start Practice
            </Button>
          </CardContent>
        </Card>
      )}

      {phase === "recording" && question && (
        <Card>
          <CardHeader>
            <CardTitle className="leading-snug">{question.question}</CardTitle>
            <CardDescription className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{mode.toUpperCase()}</Badge>
              {hasTarget ? <span>Target: {question.answerTime}s</span> : <span>No target time</span>}
              {autoStopAtRef.current && <span>• Auto-stop ON</span>}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-center">
              <div className="relative aspect-video overflow-hidden rounded-lg bg-black">
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  playsInline
                  className="h-full w-full object-cover [transform:scaleX(-1)]"
                />
                <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-recording px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-recording-foreground">
                  <CircleDot className="h-3 w-3" /> Recording
                </div>
              </div>
              <div className="flex flex-col items-center gap-2 md:min-w-[180px]">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">
                  {autoStopAtRef.current ? "Time left" : "Stopwatch"}
                </div>
                <div className="font-mono text-5xl font-semibold tabular-nums">
                  {autoStopAtRef.current && remainingMs !== null
                    ? formatTime(remainingMs)
                    : formatTime(elapsedMs)}
                </div>
                {autoStopAtRef.current && (
                  <div className="text-xs text-muted-foreground">
                    elapsed {formatTime(elapsedMs)}
                  </div>
                )}
                <div className="flex items-center gap-1.5 text-xs font-semibold text-recording">
                  <span className="recording-dot inline-block h-2 w-2 rounded-full bg-recording" />
                  REC
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button size="lg" onClick={stopRecording}>
                <Square className="mr-2 h-4 w-4" />
                Stop Recording
              </Button>
              <Button size="lg" variant="ghost" onClick={cancelRecording}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {phase === "playback" && question && playbackUrl && (
        <Card>
          <CardHeader>
            <CardTitle className="leading-snug">{question.question}</CardTitle>
            <CardDescription>
              {autoStopped ? "Auto-stopped at target." : "Review your attempt"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="overflow-hidden rounded-lg bg-black">
              <video
                src={playbackUrl}
                controls
                playsInline
                className="aspect-video w-full"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">Your attempt: {attemptSec}s</Badge>
              {targetSec ? (
                <>
                  <Badge variant="outline">Target: {targetSec}s</Badge>
                  <Badge variant={delta > 0 ? "destructive" : "default"}>
                    {delta === 0
                      ? "On time"
                      : delta > 0
                        ? `+${delta}s over`
                        : `${Math.abs(delta)}s under`}
                  </Badge>
                </>
              ) : (
                <Badge variant="outline">No target — free practice</Badge>
              )}
              <Badge variant="outline">{mode.toUpperCase()} mode</Badge>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button size="lg" onClick={retry}>
                <RotateCcw className="mr-2 h-4 w-4" />
                Retry Practice
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => {
                  const v = document.querySelector<HTMLVideoElement>("video[src]");
                  if (v) {
                    v.currentTime = 0;
                    v.play();
                  }
                }}
              >
                <Play className="mr-2 h-4 w-4" />
                Replay
              </Button>
              <Button size="lg" variant="ghost" onClick={pickDifferent}>
                <Search className="mr-2 h-4 w-4" />
                Pick a different question
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
