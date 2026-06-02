import { useCallback, useEffect, useState } from "react";
import { useFsRoot } from "@/hooks/use-fs-root";
import { deleteSession, listSessions } from "@/lib/fs/store";
import type { SessionMetadata } from "@/lib/types";

export function useSessions() {
  const { handle, permission, refreshTick, bump } = useFsRoot();
  const [sessions, setSessions] = useState<SessionMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!handle || permission !== "granted") {
      setLoading(false);
      return;
    }
    let alive = true;
    setLoading(true);
    listSessions(handle)
      .then((s) => {
        if (alive) {
          setSessions(s);
          setError(null);
        }
      })
      .catch((e) => alive && setError(String(e)))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [handle, permission, refreshTick]);

  const remove = useCallback(
    async (id: string) => {
      if (!handle) return;
      await deleteSession(handle, id);
      bump();
    },
    [handle, bump],
  );

  return { sessions, loading, error, remove };
}
