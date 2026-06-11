import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Search, ChevronDown, Shuffle, Mic } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";
import { useQuestions } from "@/hooks/use-questions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Question } from "@/lib/types";

export const Route = createFileRoute("/questions")({
  head: () => ({
    meta: [{ title: "Questions — CAS Interview Simulator" }],
  }),
  component: QuestionsPage,
});

function newId() {
  return "q_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

function QuestionsPage() {
  const { questions, upsert, remove, loading } = useQuestions();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("__all__");
  const [editing, setEditing] = useState<Question | null>(null);
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState<Question | null>(null);
  const [openAnswers, setOpenAnswers] = useState<Record<string, boolean>>({});
  const [openVariations, setOpenVariations] = useState<Record<string, boolean>>({});

  const categories = useMemo(() => {
    const set = new Set<string>();
    questions.forEach((q) => q.category && set.add(q.category));
    return Array.from(set).sort();
  }, [questions]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return questions.filter((qu) => {
      if (category !== "__all__" && qu.category !== category) return false;
      if (q && !qu.question.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [questions, search, category]);

  const openCreate = () => {
    setEditing({
      id: newId(),
      question: "",
      answer: "",
      alternativeQuestions: [],
      readingTime: 15,
      answerTime: 60,
      category: "",
      createdAt: new Date().toISOString(),
    });
    setOpen(true);
  };

  const openEdit = (q: Question) => {
    setEditing({ ...q, alternativeQuestions: q.alternativeQuestions ? [...q.alternativeQuestions] : [] });
    setOpen(true);
  };

  const handleSave = async () => {
    if (!editing) return;
    if (!editing.question.trim()) {
      toast.error("Question text is required");
      return;
    }
    try {
      const cleanedVariations = (editing.alternativeQuestions ?? [])
        .map((v) => v.trim())
        .filter((v) => v.length > 0);
      await upsert({
        ...editing,
        category: editing.category?.trim() || undefined,
        answer: editing.answer?.trim() ? editing.answer : undefined,
        alternativeQuestions: cleanedVariations.length > 0 ? cleanedVariations : undefined,
      });
      toast.success("Question saved");
      setOpen(false);
      setEditing(null);
    } catch (e) {
      toast.error("Failed to save: " + (e as Error).message);
    }
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-4 md:p-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Questions</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Saved in <span className="font-mono">questions.json</span> in your data folder.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" /> New question
        </Button>
      </div>

      <Card className="p-3">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search questions…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="sm:w-56">
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All categories</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Card>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : filtered.length === 0 ? (
        <Card className="p-10 text-center">
          <p className="text-sm text-muted-foreground">
            {questions.length === 0
              ? "No questions yet. Add your first one."
              : "No questions match your filters."}
          </p>
        </Card>
      ) : (
        <div className="grid gap-3">
          {filtered.map((q, idx) => (
            <Card key={q.id} className="p-4">
              <div className="flex flex-wrap items-start gap-3">
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-accent text-xs font-semibold text-accent-foreground">
                  {questions.findIndex((x) => x.id === q.id) + 1 || idx + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{q.question}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {q.category && <Badge variant="secondary">{q.category}</Badge>}
                    <Badge variant="outline">Read {q.readingTime}s</Badge>
                    <Badge variant="outline">Answer {q.answerTime}s</Badge>
                    {q.answer?.trim() && <Badge variant="outline">Has reference answer</Badge>}
                    {q.alternativeQuestions && q.alternativeQuestions.length > 0 && (
                      <Badge variant="outline">
                        <Shuffle className="mr-1 h-3 w-3" />
                        {q.alternativeQuestions.length} variation{q.alternativeQuestions.length === 1 ? "" : "s"}
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button asChild size="sm" variant="outline" className="h-8">
                    <Link to="/drill" search={{ questionId: q.id, mode: "auto" }}>
                      <Mic className="mr-1.5 h-3.5 w-3.5" />
                      Practice
                    </Link>
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => openEdit(q)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setDeleting(q)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <Collapsible
                open={!!openAnswers[q.id]}
                onOpenChange={(o) => setOpenAnswers((s) => ({ ...s, [q.id]: o }))}
              >
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="mt-3 h-8 px-2 text-xs text-muted-foreground">
                    <ChevronDown
                      className={`mr-1 h-3.5 w-3.5 transition-transform ${openAnswers[q.id] ? "rotate-180" : ""}`}
                    />
                    {openAnswers[q.id] ? "Hide answer" : "Show answer"}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2">
                  {q.answer?.trim() ? (
                    <div className="max-h-72 overflow-y-auto whitespace-pre-wrap break-words rounded-md border bg-muted/30 p-3 text-sm leading-relaxed">
                      {q.answer}
                    </div>
                  ) : (
                    <p className="rounded-md border border-dashed p-3 text-xs italic text-muted-foreground">
                      No reference answer available.
                    </p>
                  )}
                </CollapsibleContent>
              </Collapsible>
              {q.alternativeQuestions && q.alternativeQuestions.length > 0 && (
                <Collapsible
                  open={!!openVariations[q.id]}
                  onOpenChange={(o) => setOpenVariations((s) => ({ ...s, [q.id]: o }))}
                >
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="mt-1 h-8 px-2 text-xs text-muted-foreground">
                      <ChevronDown
                        className={`mr-1 h-3.5 w-3.5 transition-transform ${openVariations[q.id] ? "rotate-180" : ""}`}
                      />
                      {openVariations[q.id] ? "Hide variations" : "Show variations"}
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-2">
                    <div className="max-h-72 overflow-y-auto rounded-md border bg-muted/30 p-3 text-sm leading-relaxed">
                      <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Alternative question variations
                      </div>
                      <ul className="list-disc space-y-1.5 pl-5">
                        {q.alternativeQuestions.map((v, i) => (
                          <li key={i} className="whitespace-pre-wrap break-words">
                            {v}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )}
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing && questions.some((q) => q.id === editing.id) ? "Edit question" : "New question"}</DialogTitle>
            <DialogDescription>
              Set how long the candidate has to read the question and to answer it.
            </DialogDescription>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="q-text">Question</Label>
                <Textarea
                  id="q-text"
                  rows={3}
                  value={editing.question}
                  onChange={(e) => setEditing({ ...editing, question: e.target.value })}
                  placeholder="e.g. Why did you choose to study in the UK?"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="q-read">Reading time (s)</Label>
                  <Input
                    id="q-read"
                    type="number"
                    min={1}
                    value={editing.readingTime}
                    onChange={(e) =>
                      setEditing({ ...editing, readingTime: Math.max(1, Number(e.target.value) || 0) })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="q-ans">Answer time (s)</Label>
                  <Input
                    id="q-ans"
                    type="number"
                    min={1}
                    value={editing.answerTime}
                    onChange={(e) =>
                      setEditing({ ...editing, answerTime: Math.max(1, Number(e.target.value) || 0) })
                    }
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="q-cat">Category (optional)</Label>
                <Input
                  id="q-cat"
                  value={editing.category ?? ""}
                  onChange={(e) => setEditing({ ...editing, category: e.target.value })}
                  placeholder="e.g. Motivation, Finance, Course"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="q-ref-ans">Reference answer (optional)</Label>
                <Textarea
                  id="q-ref-ans"
                  rows={5}
                  value={editing.answer ?? ""}
                  onChange={(e) => setEditing({ ...editing, answer: e.target.value })}
                  placeholder="Write the ideal / prepared answer here. It is NEVER shown during the interview — only on the session review page so you can compare it with what you actually said."
                />
                <p className="text-xs text-muted-foreground">
                  Hidden during interviews. Visible only in Session History → Review.
                </p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Alternative question variations (optional)</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setEditing({
                        ...editing,
                        alternativeQuestions: [...(editing.alternativeQuestions ?? []), ""],
                      })
                    }
                  >
                    <Plus className="mr-1 h-3.5 w-3.5" /> Add variation
                  </Button>
                </div>
                {(editing.alternativeQuestions?.length ?? 0) === 0 ? (
                  <p className="rounded-md border border-dashed p-3 text-xs italic text-muted-foreground">
                    No variations yet. Add alternative phrasings of the same question.
                  </p>
                ) : (
                  <div className="max-h-64 space-y-2 overflow-y-auto rounded-md border bg-muted/20 p-2">
                    {editing.alternativeQuestions!.map((v, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <Textarea
                          rows={2}
                          value={v}
                          onChange={(e) => {
                            const next = [...editing.alternativeQuestions!];
                            next[i] = e.target.value;
                            setEditing({ ...editing, alternativeQuestions: next });
                          }}
                          placeholder={`Variation ${i + 1}`}
                          className="flex-1"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="mt-1 text-destructive hover:text-destructive"
                          onClick={() => {
                            const next = editing.alternativeQuestions!.filter((_, j) => j !== i);
                            setEditing({ ...editing, alternativeQuestions: next });
                          }}
                          aria-label="Remove variation"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  When enabled in a session, the interview can randomly pick one of these phrasings instead of the main question.
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this question?</AlertDialogTitle>
            <AlertDialogDescription>
              This only removes the question from your list. Existing recordings are not affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (deleting) await remove(deleting.id);
                setDeleting(null);
                toast.success("Question deleted");
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
