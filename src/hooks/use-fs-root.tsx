import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  clearRootHandle,
  ensurePermission,
  loadRootHandle,
  saveRootHandle,
} from "@/lib/fs/root-handle";

type Permission = "unknown" | "granted" | "denied" | "prompt";

interface FsRootContextValue {
  supported: boolean;
  ready: boolean;
  handle: FileSystemDirectoryHandle | null;
  permission: Permission;
  pickFolder: () => Promise<void>;
  requestAccess: () => Promise<boolean>;
  clear: () => Promise<void>;
  refreshTick: number;
  bump: () => void;
}

const FsRootContext = createContext<FsRootContextValue | null>(null);

export function FsRootProvider({ children }: { children: ReactNode }) {
  const [supported, setSupported] = useState(false);
  const [ready, setReady] = useState(false);
  const [handle, setHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [permission, setPermission] = useState<Permission>("unknown");
  const [refreshTick, setRefreshTick] = useState(0);

  const bump = useCallback(() => setRefreshTick((n) => n + 1), []);

  useEffect(() => {
    let mounted = true;
    const hasApi =
      typeof window !== "undefined" &&
      typeof (window as unknown as { showDirectoryPicker?: unknown }).showDirectoryPicker ===
        "function";
    setSupported(hasApi);
    if (!hasApi) {
      setReady(true);
      return;
    }
    (async () => {
      const stored = await loadRootHandle();
      if (!mounted) return;
      if (stored) {
        setHandle(stored);
        const perm = await (stored as unknown as {
          queryPermission: (o: { mode: string }) => Promise<PermissionState>;
        }).queryPermission({ mode: "readwrite" });
        if (!mounted) return;
        setPermission(perm);
      }
      setReady(true);
    })().catch(() => setReady(true));
    return () => {
      mounted = false;
    };
  }, []);

  const pickFolder = useCallback(async () => {
    const picker = (window as unknown as {
      showDirectoryPicker: (o?: {
        mode?: string;
        id?: string;
      }) => Promise<FileSystemDirectoryHandle>;
    }).showDirectoryPicker;
    const h = await picker({ mode: "readwrite", id: "cas-interview-root" });
    await saveRootHandle(h);
    setHandle(h);
    setPermission("granted");
    bump();
  }, [bump]);

  const requestAccess = useCallback(async () => {
    if (!handle) return false;
    const perm = await ensurePermission(handle, "readwrite");
    setPermission(perm);
    return perm === "granted";
  }, [handle]);

  const clear = useCallback(async () => {
    await clearRootHandle();
    setHandle(null);
    setPermission("unknown");
    bump();
  }, [bump]);

  return (
    <FsRootContext.Provider
      value={{
        supported,
        ready,
        handle,
        permission,
        pickFolder,
        requestAccess,
        clear,
        refreshTick,
        bump,
      }}
    >
      {children}
    </FsRootContext.Provider>
  );
}

export function useFsRoot() {
  const ctx = useContext(FsRootContext);
  if (!ctx) throw new Error("useFsRoot must be used within FsRootProvider");
  return ctx;
}
