import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowRight, CheckCircle2, CircleDot, X } from "lucide-react";
import { useFsRoot } from "@/hooks/use-fs-root";
import { readSession, writeBlob, writeSessionMetadata, getSessionDir } from "@/lib/fs/store";
import { answerFilename } from "@/lib/fs/filenames";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
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
import type { SessionMetadata, SessionQuestion } from "@/lib/types";

export const Route = createFileRoute("/sessions/run/$sessionId")({
  head: () => ({ meta: [{ title: "Interview in progress" }] }),
  component: RunInterview,
});

interface PlannedQuestion {
  id: string;
  question: string;
  answer?: string;
  alternativeQuestions?: string[];
  readingTime: number;
  answerTime: number;
}

type TransitionMode = "manual" | "automatic";

type Phase =
  | "preparing"
  | "reading"
  | "recording"
  | "between"
  | "finished"
  | "done"
  | "error"
  | "aborted";

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

function RunInterview() {
  const { sessionId } = Route.useParams();
  const { handle } = useFsRoot();
  const navigate = useNavigate();

  const [plan, setPlan] = useState<PlannedQuestion[]>([]);
  const [transitionMode, setTransitionMode] = useState<TransitionMode>("manual");
  const [useVariations, setUseVariations] = useState(false);
  const [displayedQuestions, setDisplayedQuestions] = useState<Record<number, string>>({});
  const [meta, setMeta] = useState<SessionMetadata | null>(null);
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("preparing");
  const [saving, setSaving] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [showAbort, setShowAbort] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const abortRef = useRef<AbortController>(new AbortController());
  const metaRef = useRef<SessionMetadata | null>(null);
  const startTimeRef = useRef<number>(0);
  const transitionModeRef = useRef<TransitionMode>("manual");
  const useVariationsRef = useRef(false);
  const displayedQuestionsRef = useRef<Record<number, string>>({});

  // ---- Load plan + metadata ----
  useEffect(() => {
    if (!handle) return;
    let alive = true;
    (async () => {
      try {
        const stored = sessionStorage.getItem(`cas:plan:${sessionId}`);
        if (!stored) {
          setError("No plan found for this session. Please create a new session.");
          setPhase("error");
          return;
        }
        const parsed = JSON.parse(stored);
        // Backwards compatible: old shape was an array of questions.
        const planned: PlannedQuestion[] = Array.isArray(parsed) ? parsed : parsed.questions;
        const mode: TransitionMode =
          !Array.isArray(parsed) && parsed.transitionMode === "automatic"
            ? "automatic"
            : "manual";
        const variations: boolean =
          !Array.isArray(parsed) && parsed.useVariations === true;
        const m = await readSession(handle, sessionId);
        if (!alive) return;
        if (!m) {
          setError("Session not found.");
          setPhase("error");
          return;
        }
        setPlan(planned);
        setTransitionMode(mode);
        transitionModeRef.current = mode;
        setUseVariations(variations);
        useVariationsRef.current = variations;
        setMeta(m);
        metaRef.current = m;
      } catch (e) {
        setError((e as Error).message);
        setPhase("error");
      }
    })();
    return () => {
      alive = false;
    };
  }, [handle, sessionId]);

  // ---- Acquire media stream once plan is ready ----
  useEffect(() => {
    if (!meta || plan.length === 0 || phase !== "preparing") return;
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: true,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        startTimeRef.current = Date.now();
        setPhase("reading");
      } catch (e) {
        setError("Camera/microphone access denied: " + (e as Error).message);
        setPhase("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [meta, plan, phase]);

  // Re-attach the live stream to the <video> element whenever it remounts
  // (e.g. when phase changes between recording/between).
  useEffect(() => {
    if (videoRef.current && streamRef.current && videoRef.current.srcObject !== streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [phase]);

  // ---- Drive the state machine ----
  useEffect(() => {
    if (phase !== "reading" && phase !== "recording") return;
    if (!plan[index]) return;
    const signal = abortRef.current.signal;
    let cancelled = false;
    const q = plan[index];

    // Lock in displayed question for this index on first entry.
    if (displayedQuestionsRef.current[index] === undefined) {
      let displayed = q.question;
      if (useVariationsRef.current && q.alternativeQuestions && q.alternativeQuestions.length > 0) {
        const pool = [q.question, ...q.alternativeQuestions];
        displayed = pool[Math.floor(Math.random() * pool.length)];
      }
      displayedQuestionsRef.current = { ...displayedQuestionsRef.current, [index]: displayed };
      setDisplayedQuestions((s) => ({ ...s, [index]: displayed }));
    }
    const displayedQuestion = displayedQuestionsRef.current[index] ?? q.question;


    async function runReading() {
      await countdown(q.readingTime, setSecondsLeft, signal);
      if (cancelled) return;
      setPhase("recording");
    }

    async function runRecording() {
      if (!streamRef.current || !handle || !metaRef.current) return;
      const mime = pickMime();
      const rec = new MediaRecorder(streamRef.current, mime ? { mimeType: mime } : undefined);
      recorderRef.current = rec;
      const chunks: Blob[] = [];
      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };
      const stopped = new Promise<void>((resolve) => {
        rec.onstop = () => resolve();
      });
      rec.start(1000);
      const startedAt = Date.now();
      try {
        await countdown(q.answerTime, setSecondsLeft, signal);
      } catch {
        // aborted; still flush
      }
      if (rec.state !== "inactive") rec.stop();
      await stopped;
      const recordingDuration = Math.round((Date.now() - startedAt) / 1000);
      const blob = new Blob(chunks, { type: mime || "video/webm" });
      if (cancelled) return;
      setSaving(true);
      try {
        const filename = answerFilename(index, q.question);
        await writeBlob(await getSessionDir(handle, sessionId, true), filename, blob);
        const record: SessionQuestion = {
          questionId: q.id,
          questionText: q.question,
          displayedQuestion: displayedQuestion !== q.question ? displayedQuestion : undefined,
          answer: q.answer,
          readingTime: q.readingTime,
          answerTime: q.answerTime,
          videoFile: filename,
          recordingDuration,
        };
        const isLast = index + 1 >= plan.length;
        const nextMeta: SessionMetadata = {
          ...metaRef.current!,
          questions: [...metaRef.current!.questions, record],
          durationSeconds: Math.round((Date.now() - startTimeRef.current) / 1000),
          completed: isLast,
        };
        metaRef.current = nextMeta;
        setMeta(nextMeta);
        await writeSessionMetadata(handle, sessionId, nextMeta);
      } catch (e) {
        setSaving(false);
        setError("Failed to save recording: " + (e as Error).message);
        setPhase("error");
        return;
      }
      setSaving(false);
      const isLast = index + 1 >= plan.length;
      const mode = transitionModeRef.current;
      if (isLast) {
        if (mode === "automatic") {
          cleanup();
          setPhase("done");
        } else {
          cleanup();
          setPhase("finished");
        }
      } else {
        if (mode === "automatic") {
          setIndex((i) => i + 1);
          setPhase("reading");
        } else {
          setPhase("between");
        }
      }
    }

    if (phase === "reading") {
      runReading().catch((e) => {
        if ((e as Error).name !== "AbortError") {
          setError((e as Error).message);
          setPhase("error");
        }
      });
    } else if (phase === "recording") {
      runRecording().catch((e) => {
        if ((e as Error).name !== "AbortError") {
          setError((e as Error).message);
          setPhase("error");
        }
      });
    }

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, index, plan]);

  // ---- Cleanup on unmount or done ----
  useEffect(() => {
    return () => cleanup();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (phase === "done") {
      navigate({ to: "/sessions/complete/$sessionId", params: { sessionId } });
    }
  }, [phase, navigate, sessionId]);

  function cleanup() {
    try {
      recorderRef.current?.state !== "inactive" && recorderRef.current?.stop();
    } catch {
      /* noop */
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  const performAbort = async () => {
    abortRef.current.abort();
    try {
      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        recorderRef.current.stop();
      }
    } catch {
      /* noop */
    }
    if (handle && metaRef.current) {
      const finalMeta: SessionMetadata = {
        ...metaRef.current,
        completed: false,
        durationSeconds: Math.round((Date.now() - startTimeRef.current) / 1000),
      };
      try {
        await writeSessionMetadata(handle, sessionId, finalMeta);
      } catch {
        /* noop */
      }
    }
    cleanup();
    setPhase("aborted");
    toast.info("Interview aborted");
    navigate({ to: "/sessions" });
  };

  const handleNext = () => {
    setIndex((i) => i + 1);
    setPhase("reading");
  };

  const current = plan[index];
  const progress = plan.length
    ? (((phase === "between" || phase === "finished" ? index + 1 : index + (phase === "recording" || saving ? 0.5 : 0)) /
        plan.length) *
        100)
    : 0;

  const phaseSecondsTotal = useMemo(() => {
    if (!current) return 0;
    if (phase === "reading") return current.readingTime;
    if (phase === "recording") return current.answerTime;
    return 0;
  }, [current, phase]);

  if (phase === "error") {
    return (
      <div className="grid min-h-screen place-items-center p-6">
        <div className="max-w-md space-y-4 text-center">
          <h1 className="font-display text-2xl font-semibold">Couldn't start interview</h1>
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button onClick={() => navigate({ to: "/sessions/new" })}>Back</Button>
        </div>
      </div>
    );
  }

  if (phase === "finished") {
    return (
      <div className="grid min-h-screen place-items-center p-6">
        <div className="max-w-md space-y-6 text-center">
          <div className="flex justify-center">
            <CheckCircle2 className="h-16 w-16 text-primary" />
          </div>
          <div className="space-y-2">
            <h1 className="font-display text-3xl font-semibold">Interview completed</h1>
            <p className="text-sm text-muted-foreground">
              All {plan.length} answers saved to your folder.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Button
              size="lg"
              onClick={() =>
                navigate({ to: "/sessions/$sessionId", params: { sessionId } })
              }
            >
              View session summary
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <Button variant="ghost" size="lg" onClick={() => navigate({ to: "/sessions" })}>
              Back to sessions
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!meta || !current) {
    return (
      <div className="grid min-h-screen place-items-center p-6 text-sm text-muted-foreground">
        Preparing…
      </div>
    );
  }

  return (
    <div className="relative min-h-screen flex flex-col bg-background">
      {/* Top bar */}
      <header className="flex items-center justify-between border-b px-4 py-3 md:px-6">
        <div className="flex items-center gap-3">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">
            {meta.sessionName}
          </div>
          <div className="hidden sm:block text-xs text-muted-foreground">·</div>
          <div className="text-sm font-medium">
            Question {Math.min(index + 1, plan.length)} of {plan.length}
          </div>
          <div className="hidden sm:block text-xs text-muted-foreground">·</div>
          <div className="hidden sm:block text-xs text-muted-foreground capitalize">
            {transitionMode} mode
          </div>
        </div>
        <div className="flex items-center gap-3">
          {phase === "recording" && (
            <div className="flex items-center gap-2 rounded-full bg-recording/10 px-3 py-1 text-xs font-semibold text-recording">
              <span className="recording-dot inline-block h-2.5 w-2.5 rounded-full bg-recording" />
              REC
            </div>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAbort(true)}
            className="text-muted-foreground hover:text-destructive"
          >
            <X className="mr-1 h-4 w-4" /> Abort
          </Button>
        </div>
      </header>

      <Progress value={progress} className="h-1 rounded-none" />

      {/* Body */}
      <div className="flex-1 grid lg:grid-cols-[1.4fr_1fr] gap-0">
        {/* Question + countdown OR between-question card */}
        <div className="flex flex-col items-center justify-center gap-8 p-6 md:p-12">
          {phase === "between" ? (
            <div className="flex flex-col items-center gap-6 text-center max-w-md">
              <CheckCircle2 className="h-16 w-16 text-primary" />
              <div className="space-y-2">
                <h2 className="font-display text-3xl font-semibold">
                  Answer recorded successfully
                </h2>
                <p className="text-sm text-muted-foreground">
                  Question {index + 1} of {plan.length} completed
                </p>
              </div>
              <div className="flex flex-col gap-2 w-full sm:w-auto sm:flex-row">
                <Button size="lg" onClick={handleNext}>
                  Next question
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                <Button variant="ghost" size="lg" onClick={() => setShowAbort(true)}>
                  Abort interview
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="text-center">
                <div className="text-xs uppercase tracking-widest text-muted-foreground">
                  {saving
                    ? "Saving…"
                    : phase === "reading"
                      ? "Read the question"
                      : phase === "recording"
                        ? "Answer now"
                        : phase === "preparing"
                          ? "Preparing camera…"
                          : ""}
                </div>
                <h2 className="mt-4 font-display text-2xl md:text-4xl font-semibold leading-tight max-w-3xl">
                  {current.question}
                </h2>
              </div>

              <div className="flex flex-col items-center">
                <CountdownRing
                  seconds={secondsLeft}
                  total={phaseSecondsTotal || 1}
                  tone={phase === "recording" ? "recording" : "primary"}
                />
                <div className="mt-3 text-xs text-muted-foreground">
                  {saving
                    ? "Writing to your folder"
                    : phase === "reading"
                      ? "Recording starts automatically"
                      : phase === "recording"
                        ? "Auto-stops at 0"
                        : ""}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Webcam preview */}
        <div className="border-t lg:border-t-0 lg:border-l bg-black/90 p-4 flex items-center justify-center">
          <div className="relative w-full max-w-md aspect-video overflow-hidden rounded-lg bg-black">
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="h-full w-full object-cover [transform:scaleX(-1)]"
            />
            {phase === "recording" && (
              <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-recording px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-recording-foreground">
                <CircleDot className="h-3 w-3" /> Live
              </div>
            )}
          </div>
        </div>
      </div>

      <AlertDialog open={showAbort} onOpenChange={setShowAbort}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Abort the interview?</AlertDialogTitle>
            <AlertDialogDescription>
              The session will be marked incomplete. Already-saved recordings are kept.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep going</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShowAbort(false);
                performAbort();
              }}
            >
              Abort
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function CountdownRing({
  seconds,
  total,
  tone,
}: {
  seconds: number;
  total: number;
  tone: "primary" | "recording";
}) {
  const radius = 80;
  const circ = 2 * Math.PI * radius;
  const pct = Math.max(0, Math.min(1, seconds / total));
  const dash = circ * pct;
  const color = tone === "recording" ? "var(--recording)" : "var(--primary)";
  return (
    <div className="relative h-48 w-48">
      <svg viewBox="0 0 200 200" className="h-full w-full -rotate-90">
        <circle cx="100" cy="100" r={radius} stroke="var(--muted)" strokeWidth="10" fill="none" />
        <circle
          cx="100"
          cy="100"
          r={radius}
          stroke={color}
          strokeWidth="10"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`}
          style={{ transition: "stroke-dasharray 0.9s linear" }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <div className="font-mono text-5xl font-semibold tabular-nums">{seconds}</div>
      </div>
    </div>
  );
}

function countdown(
  seconds: number,
  onTick: (n: number) => void,
  signal: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    let left = seconds;
    onTick(left);
    const id = window.setInterval(() => {
      if (signal.aborted) {
        window.clearInterval(id);
        reject(new DOMException("Aborted", "AbortError"));
        return;
      }
      left -= 1;
      onTick(Math.max(0, left));
      if (left <= 0) {
        window.clearInterval(id);
        resolve();
      }
    }, 1000);
    signal.addEventListener("abort", () => {
      window.clearInterval(id);
      reject(new DOMException("Aborted", "AbortError"));
    });
  });
}
