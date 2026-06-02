import { createFileRoute, Link } from "@tanstack/react-router";
import { ListChecks, History, Video, Clock, PlayCircle, ArrowRight } from "lucide-react";
import { useQuestions } from "@/hooks/use-questions";
import { useSessions } from "@/hooks/use-sessions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — CAS Interview Simulator" },
      { name: "description", content: "Your local interview practice overview." },
    ],
  }),
  component: Dashboard,
});

function Stat({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  icon: typeof ListChecks;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardDescription className="text-xs uppercase tracking-wider">{label}</CardDescription>
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <CardTitle className="font-display text-3xl">{value}</CardTitle>
      </CardHeader>
    </Card>
  );
}

function Dashboard() {
  const { questions } = useQuestions();
  const { sessions } = useSessions();

  const totalAnswers = sessions.reduce((sum, s) => sum + s.questions.length, 0);
  const totalSeconds = sessions.reduce((sum, s) => sum + (s.durationSeconds || 0), 0);
  const totalHours = (totalSeconds / 3600).toFixed(1);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8 p-4 md:p-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl md:text-4xl font-semibold tracking-tight">
            Welcome back
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Practice realistic credibility interviews — recordings stay on your machine.
          </p>
        </div>
        <Button asChild size="lg">
          <Link to="/sessions/new">
            <PlayCircle className="mr-2 h-4 w-4" />
            Start new session
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Questions" value={questions.length} icon={ListChecks} />
        <Stat label="Sessions" value={sessions.length} icon={History} />
        <Stat label="Recorded answers" value={totalAnswers} icon={Video} />
        <Stat label="Practice hours" value={totalHours} icon={Clock} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent sessions</CardTitle>
            <CardDescription>Latest mock interviews from your folder.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {sessions.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No sessions yet. Create your first one to get started.
              </p>
            )}
            {sessions.slice(0, 5).map((s) => (
              <Link
                key={s.sessionId}
                to="/sessions/$sessionId"
                params={{ sessionId: s.sessionId }}
                className="flex items-center justify-between rounded-md border bg-card p-3 text-sm transition hover:bg-accent"
              >
                <div className="min-w-0">
                  <div className="truncate font-medium">{s.sessionName}</div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(s.createdAt).toLocaleString()} · {s.questions.length}/
                    {s.totalQuestions} answers
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick actions</CardTitle>
            <CardDescription>Manage what you'll be asked.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            <Button asChild variant="outline" className="justify-start">
              <Link to="/questions">
                <ListChecks className="mr-2 h-4 w-4" />
                Manage questions
              </Link>
            </Button>
            <Button asChild variant="outline" className="justify-start">
              <Link to="/sessions">
                <History className="mr-2 h-4 w-4" />
                Browse history
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
