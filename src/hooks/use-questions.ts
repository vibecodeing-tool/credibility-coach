import { useCallback, useEffect, useState } from "react";
import { useFsRoot } from "@/hooks/use-fs-root";
import { readQuestions, writeQuestions } from "@/lib/fs/store";
import type { Question } from "@/lib/types";

export function useQuestions() {
  const { handle, permission, refreshTick, bump } = useFsRoot();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!handle || permission !== "granted") {
      setLoading(false);
      return;
    }
    let alive = true;
    setLoading(true);
    readQuestions(handle)
      .then((q) => {
        if (alive) {
          setQuestions(q);
          setError(null);
        }
      })
      .catch((e) => alive && setError(String(e)))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [handle, permission, refreshTick]);

  const save = useCallback(
    async (next: Question[]) => {
      if (!handle) throw new Error("No folder selected");
      await writeQuestions(handle, next);
      setQuestions(next);
      bump();
    },
    [handle, bump],
  );

  const upsert = useCallback(
    async (q: Question) => {
      const existing = questions.findIndex((x) => x.id === q.id);
      const next = existing >= 0 ? questions.map((x) => (x.id === q.id ? q : x)) : [...questions, q];
      await save(next);
    },
    [questions, save],
  );

  const remove = useCallback(
    async (id: string) => {
      await save(questions.filter((q) => q.id !== id));
    },
    [questions, save],
  );

  return { questions, loading, error, upsert, remove, save };
}
