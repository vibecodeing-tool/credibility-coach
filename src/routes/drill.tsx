import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Timer, Mic, Square, RotateCcw, Play, CircleDot } from "lucide-react";
import { useQuestions } from "@/hooks/use-questions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Question } from "@/lib/types";

export const Route = createFileRoute("/drill")({
  head: () => ({ meta: [{ title: "Speaking Drill — Quick Practice" }] }),
  component: DrillPage,
});

type Phase = "select" | "recording" | "playback";

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
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60).toString().padStart(2, "0");
  const s = (total % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function DrillPage() {
  const { questions, loading } = useQuestions();
  const [questionId, setQuestionId] = useState<string>("");
  const [phase, setPhase] = useState<Phase>("select");
  const [elapsedMs, setElapsedMs] = useState(0);
  const [finalMs, setFinalMs] = useState(0);
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const videoRef = useRef<HTMLVideoElement>(null);
  const tickRef = useRef<number | null>(null);
  const startedAtRef = useRef<number>(0);
  const urlRef = useRef<string | null>(null);

  const question: Question | undefined = questions.find((q) => q.id === questionId);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopStream();
      if (tickRef.current) window.clearInterval(tickRef.current);
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    };
  }, []);

  // Attach stream to video element whenever recording phase is active
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
      setElapsedMs(0);
      tickRef.current = window.setInterval(() => {
        setElapsedMs(Date.now() - startedAtRef.current);
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
    setPhase("select");
  }

  const targetSec = question?.answerTime;
  const attemptSec = Math.round(finalMs / 1000);
  const delta = targetSec ? attemptSec - targetSec : 0;

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
                  : "Choose one question to drill."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Select value={questionId} onValueChange={setQuestionId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a question…" />
              </SelectTrigger>
              <SelectContent>
                {questions.map((q) => (
                  <SelectItem key={q.id} value={q.id}>
                    <span className="line-clamp-1">{q.question}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {question && (
              <div className="rounded-md border bg-muted/30 p-4 space-y-3">
                <p className="font-medium leading-snug break-words">{question.question}</p>
                <div className="flex flex-wrap items-center gap-2">
                  {question.category && <Badge variant="secondary">{question.category}</Badge>}
                  {question.answerTime ? (
                    <Badge variant="outline">Target: {question.answerTime}s</Badge>
                  ) : null}
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
            <CardDescription className="flex items-center gap-2">
              {question.answerTime ? <span>Target: {question.answerTime}s</span> : <span>No target time</span>}
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
                  Stopwatch
                </div>
                <div className="font-mono text-5xl font-semibold tabular-nums">
                  {formatTime(elapsedMs)}
                </div>
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
            <CardDescription>Review your attempt</CardDescription>
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
                        : `${delta}s under`}
                  </Badge>
                </>
              ) : null}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button size="lg" onClick={retry}>
                <RotateCcw className="mr-2 h-4 w-4" />
                Retry Practice
              </Button>
              <Button size="lg" variant="outline" onClick={() => {
                const v = document.querySelector<HTMLVideoElement>("video[src]");
                if (v) { v.currentTime = 0; v.play(); }
              }}>
                <Play className="mr-2 h-4 w-4" />
                Replay
              </Button>
              <Button size="lg" variant="ghost" onClick={pickDifferent}>
                Pick a different question
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
