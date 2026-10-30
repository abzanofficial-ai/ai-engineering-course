"use client";

// Learner state on the client (ADR-0009): optimistic updates, a per-user outbox in
// localStorage that survives reloads and offline periods, and XP toasts from the server.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { localDay } from "@/lib/dates";
import { applyLocal, emptyState, type LearnerState } from "@/lib/learner-state";
import type { Op, OpInput, OpResult } from "@/lib/ops-schema";

type Status = "loading" | "anon" | "ready";
export type SaveStatus = "saved" | "saving" | "offline";

interface LearnerContext {
  status: Status;
  user: { name: string; email: string; platformRole: string | null } | null;
  state: LearnerState;
  save: SaveStatus;
  dispatch: (op: OpInput) => void;
  /** Replace state with a fresh server response (e.g. after a checkpoint submission). */
  acceptServerState: (s: LearnerState) => void;
  notify: (text: string) => void;
  /** Shown when a signed-out reader tries to save something. */
  promptAccount: boolean;
  dismissPrompt: () => void;
}

const Ctx = createContext<LearnerContext | null>(null);

export function useLearner(): LearnerContext {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useLearner must be used inside <LearnerProvider>");
  return ctx;
}

const storage = {
  read<T>(key: string, fallback: T): T {
    try {
      const v = localStorage.getItem(key);
      return v === null ? fallback : (JSON.parse(v) as T);
    } catch {
      return fallback;
    }
  },
  write(key: string, value: unknown) {
    try {
      if (value === null || (Array.isArray(value) && !value.length)) localStorage.removeItem(key);
      else localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Storage unavailable: everything still works in memory for this page view.
    }
  },
};

/** Removes every learner key from this device (sign-out and account deletion). */
export function clearLearnerStorage() {
  try {
    for (const k of Object.keys(localStorage))
      if (/^(outbox|snapshot|lastUser):/.test(k)) localStorage.removeItem(k);
  } catch {
    // ignore
  }
}

type Me = NonNullable<LearnerContext["user"]>;

export function LearnerProvider({ course, children }: { course: string; children: ReactNode }) {
  const [status, setStatus] = useState<Status>("loading");
  const [user, setUser] = useState<LearnerContext["user"]>(null);
  const [server, setServer] = useState<LearnerState>(emptyState);
  const [pending, setPending] = useState<Op[]>([]);
  const [save, setSave] = useState<SaveStatus>("saved");
  const [promptAccount, setPrompt] = useState(false);
  const [toasts, setToasts] = useState<{ id: number; text: string }[]>([]);
  const outboxKey = useRef<string | null>(null);
  const snapshotKey = useRef<string | null>(null);
  const pendingRef = useRef<Op[]>([]);
  const flushing = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastId = useRef(0);
  // Retries call the latest flush through a ref (a callback can't name itself before it exists).
  const flushRef = useRef<(keepalive?: boolean) => Promise<void>>(async () => {});
  const retry = (ms: number) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void flushRef.current(), ms);
  };

  const state = useMemo(() => pending.reduce(applyLocal, server), [server, pending]);

  const setPendingBoth = useCallback((ops: Op[]) => {
    pendingRef.current = ops;
    setPending(ops);
    if (outboxKey.current) storage.write(outboxKey.current, ops);
  }, []);

  const toast = useCallback((text: string) => {
    const id = ++toastId.current;
    setToasts((t) => [...t.slice(-2), { id, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2200);
  }, []);

  const flush = useCallback(
    async (keepalive = false) => {
      if (flushing.current || !pendingRef.current.length) return;
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        setSave("offline");
        return;
      }
      flushing.current = true;
      setSave("saving");
      const batch = pendingRef.current.slice(0, 100);
      try {
        const res = await fetch("/api/me/ops", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ course, day: localDay(), ops: batch }),
          keepalive,
        });
        if (res.status === 401) {
          setStatus("anon");
          setUser(null);
          return;
        }
        if (!res.ok && res.status !== 400) throw new Error(String(res.status));
        const body = (await res.json()) as { results?: OpResult[]; state?: LearnerState };
        // Delivered (or permanently invalid): drop from the outbox either way.
        setPendingBoth(pendingRef.current.slice(batch.length));
        if (body.state) {
          setServer(body.state);
          if (snapshotKey.current) storage.write(snapshotKey.current, body.state);
        }
        const xp = (body.results ?? []).reduce((n, r) => n + (r.ok && r.xp ? r.xp : 0), 0);
        if (xp) toast(`+${xp} XP`);
        setSave(pendingRef.current.length ? "saving" : "saved");
      } catch {
        setSave(typeof navigator !== "undefined" && !navigator.onLine ? "offline" : "saving");
        retry(5000);
      } finally {
        flushing.current = false;
      }
      if (pendingRef.current.length) retry(300);
    },
    [course, setPendingBoth, toast],
  );

  useEffect(() => {
    flushRef.current = flush;
  }, [flush]);

  // Load (and reload after reconnecting). The outbox and snapshot are per user, so a shared
  // device never replays or shows someone else's progress.
  const load = useCallback(async () => {
    const remembered = storage.read<Me | null>(`lastUser:${course}`, null);
    try {
      const res = await fetch(
        `/api/me/state?course=${encodeURIComponent(course)}&day=${localDay()}`,
        { cache: "no-store" },
      );
      if (res.status === 401) {
        setStatus("anon");
        setUser(null);
        return;
      }
      if (!res.ok) throw new Error(String(res.status));
      const body = (await res.json()) as { user: Me; state: LearnerState };
      if (remembered && remembered.email !== body.user.email) clearLearnerStorage();
      outboxKey.current = `outbox:${course}:${body.user.email}`;
      snapshotKey.current = `snapshot:${course}:${body.user.email}`;
      storage.write(`lastUser:${course}`, body.user);
      storage.write(snapshotKey.current, body.state);
      const queued = storage.read<Op[]>(outboxKey.current, []);
      setUser(body.user);
      setServer(body.state);
      pendingRef.current = queued;
      setPending(queued);
      setStatus("ready");
      if (queued.length) void flushRef.current();
    } catch {
      // Offline: show the last known state for the last signed-in learner and keep queueing.
      if (!remembered) {
        setStatus("anon");
        return;
      }
      outboxKey.current = `outbox:${course}:${remembered.email}`;
      snapshotKey.current = `snapshot:${course}:${remembered.email}`;
      const queued = storage.read<Op[]>(outboxKey.current, []);
      setUser(remembered);
      setServer(storage.read<LearnerState>(snapshotKey.current, emptyState()));
      pendingRef.current = queued;
      setPending(queued);
      setSave("offline");
      setStatus("ready");
    }
  }, [course]);

  useEffect(() => {
    // Defer to after mount so the server-rendered markup hydrates first.
    const t = setTimeout(() => void load(), 0);
    return () => clearTimeout(t);
  }, [load]);

  useEffect(() => {
    const online = () => void load().then(() => flushRef.current());
    const offline = () => setSave("offline");
    const hide = () => {
      if (document.visibilityState === "hidden") void flush(true);
    };
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    document.addEventListener("visibilitychange", hide);
    return () => {
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
      document.removeEventListener("visibilitychange", hide);
    };
  }, [flush, load]);

  const dispatch = useCallback(
    (op: OpInput) => {
      if (status !== "ready") {
        // Paging through Learn is free for visitors; ticks, answers and ratings need an account.
        if (op.type !== "position" && op.type !== "section_read") setPrompt(true);
        return;
      }
      const full = { ...op, ts: Date.now() } as Op;
      // Positions overwrite each other; keep only the latest in the queue.
      const rest =
        full.type === "position"
          ? pendingRef.current.filter((o) => o.type !== "position")
          : pendingRef.current;
      setPendingBoth([...rest, full]);
      setSave(typeof navigator !== "undefined" && !navigator.onLine ? "offline" : "saving");
      retry(full.type === "position" ? 1500 : 400);
    },
    [status, setPendingBoth],
  );

  const acceptServerState = useCallback((s: LearnerState) => {
    setServer(s);
    if (snapshotKey.current) storage.write(snapshotKey.current, s);
  }, []);

  const value = useMemo<LearnerContext>(
    () => ({
      status,
      user,
      state,
      save,
      dispatch,
      acceptServerState,
      notify: toast,
      promptAccount,
      dismissPrompt: () => setPrompt(false),
    }),
    [status, user, state, save, dispatch, acceptServerState, toast, promptAccount],
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className="toast show">
            {t.text}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
