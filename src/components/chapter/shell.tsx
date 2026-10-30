"use client";

// Chapter modes (design-system §5.2): tabs, one Learn card at a time, resume position,
// and deep links (#section-key) that open the right mode and card.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import type { CSSProperties } from "react";
import { pageCounts, pageProgress, type PageSpec } from "@/lib/learner-state";
import type { Mode } from "@/lib/ops-schema";
import { Icon } from "../icons";
import { useLearner } from "../learner/provider";

interface ChapterCtx {
  pageKey: string;
  spec: PageSpec;
  modes: Mode[];
  mode: Mode;
  setMode: (m: Mode, focus?: boolean) => void;
  learnIndex: number;
  setLearnIndex: (i: number) => void;
  learnKeys: string[];
}

const Ctx = createContext<ChapterCtx | null>(null);
export function useChapter(): ChapterCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useChapter outside <ChapterShell>");
  return c;
}

function subscribeHash(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}
const readHash = () => decodeURIComponent(window.location.hash.slice(1));

const LABEL: Record<Mode, string> = {
  learn: "Learn",
  practise: "Practise",
  decide: "Decide",
  review: "Review",
};

export function ChapterShell({
  pageKey,
  spec,
  modes,
  learnKeys,
  anchors,
  children,
}: {
  pageKey: string;
  spec: PageSpec;
  modes: Mode[];
  learnKeys: string[];
  /** Section or element id → mode, for deep links. */
  anchors: Record<string, Mode>;
  children: ReactNode;
}) {
  const { state, status, dispatch } = useLearner();
  const hash = useSyncExternalStore(subscribeHash, readHash, () => "");
  // Until the learner picks a mode or card, show the deep-linked one, else where they left off.
  const [chosen, setChosen] = useState<{ mode: Mode; index: number } | null>(null);
  const initial = useMemo(() => {
    if (hash) {
      const li = learnKeys.indexOf(hash);
      if (li >= 0) return { mode: "learn" as Mode, index: li };
      if (anchors[hash]) return { mode: anchors[hash]!, index: 0 };
    }
    const last = state.last;
    if (last && last.pageKey === pageKey && modes.includes(last.mode as Mode))
      return {
        mode: last.mode as Mode,
        index: Math.min(last.sectionIndex, Math.max(0, learnKeys.length - 1)),
      };
    return { mode: modes[0]!, index: 0 };
  }, [hash, learnKeys, anchors, state.last, pageKey, modes]);
  const { mode, index: learnIndex } = chosen ?? initial;

  // Bring the top of the panel into view just below the sticky header and tabs.
  const scrollToTabs = () => {
    const tabs = document.querySelector<HTMLElement>(".tabs");
    const header = document.querySelector<HTMLElement>(".bar")?.offsetHeight ?? 0;
    if (!tabs) return;
    const top = tabs.getBoundingClientRect().top + window.scrollY - header;
    if (window.scrollY > top) window.scrollTo({ top });
  };

  const setMode = useCallback(
    (m: Mode, focus = false) => {
      setChosen({ mode: m, index: learnIndex });
      dispatch({ type: "position", page: pageKey, mode: m, index: learnIndex });
      if (focus) requestAnimationFrame(() => document.getElementById(`tab-${m}`)?.focus());
      scrollToTabs();
    },
    [dispatch, pageKey, learnIndex],
  );

  const setLearnIndex = useCallback(
    (i: number) => {
      setChosen({ mode: "learn", index: i });
      dispatch({ type: "position", page: pageKey, mode: "learn", index: i });
      scrollToTabs();
      requestAnimationFrame(() =>
        document.getElementById("learn-title")?.focus({ preventScroll: true }),
      );
    },
    [dispatch, pageKey],
  );

  // Deep links into Practise/Decide/Review scroll to their target once that panel is visible.
  useEffect(() => {
    if (hash && anchors[hash])
      requestAnimationFrame(() => document.getElementById(hash)?.scrollIntoView());
  }, [hash, anchors]);

  // Opening a chapter records it as the place to continue from.
  const recorded = useRef(false);
  useEffect(() => {
    if (recorded.current || status !== "ready") return;
    recorded.current = true;
    dispatch({ type: "position", page: pageKey, mode: initial.mode, index: initial.index });
  }, [status, dispatch, pageKey, initial]);

  return (
    <Ctx.Provider
      value={{ pageKey, spec, modes, mode, setMode, learnIndex, setLearnIndex, learnKeys }}
    >
      {modes.length > 1 && <ModeTabs />}
      {children}
    </Ctx.Provider>
  );
}

function ModeTabs() {
  const { modes, mode, setMode, spec } = useChapter();
  const { state, status } = useLearner();
  const c = pageCounts(spec, state);
  const label: Record<Mode, string> = {
    learn: `${c.learn[0]}/${c.learn[1]} read`,
    practise: `${c.steps[0]}/${c.steps[1]} steps`,
    decide: c.drill ? "Done" : "1 scenario",
    review: `${c.cards[0]}/${c.cards[1]} rated`,
  };
  const onKey = (e: React.KeyboardEvent, i: number) => {
    const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    setMode(modes[(i + d + modes.length) % modes.length]!, true);
  };
  return (
    <nav className="tabs" aria-label="Chapter modes">
      <div className="wrap" role="tablist" style={{ "--n": modes.length } as CSSProperties}>
        {modes.map((m, i) => (
          <button
            key={m}
            id={`tab-${m}`}
            className={`tab m-${m}`}
            role="tab"
            aria-selected={mode === m}
            aria-controls={`panel-${m}`}
            tabIndex={mode === m ? 0 : -1}
            onClick={() => setMode(m)}
            onKeyDown={(e) => onKey(e, i)}
          >
            <Icon name={m} />
            <span>{LABEL[m]}</span>
            <small>{status === "ready" ? label[m] : " "}</small>
          </button>
        ))}
      </div>
    </nav>
  );
}

export function ModePanel({ mode, children }: { mode: Mode; children: ReactNode }) {
  const c = useChapter();
  const tabbed = c.modes.length > 1;
  return (
    <section
      id={`panel-${mode}`}
      className={`m-${mode}`}
      role={tabbed ? "tabpanel" : undefined}
      aria-labelledby={tabbed ? `tab-${mode}` : undefined}
      hidden={c.mode !== mode}
    >
      <div className="wrap panel-wrap">{children}</div>
    </section>
  );
}

export function ChapterPercent() {
  const { spec } = useChapter();
  const { state, status } = useLearner();
  if (status !== "ready") return null;
  const pct = pageProgress(spec, state);
  return (
    <div className="ch-pct">
      <span className="pct">{pct}%</span>
      <div className="bar-track" aria-hidden="true">
        <div className="bar-fill" style={{ width: `${pct}%` }} />
      </div>
      <span className="muted">of this chapter</span>
    </div>
  );
}

export function SaveStatus() {
  const { status, save } = useLearner();
  if (status !== "ready") return null;
  const text = save === "saved" ? "Saved" : save === "saving" ? "Saving…" : "Offline: will sync";
  return (
    <span className="save-status" aria-live="polite">
      {save === "saved" && <Icon name="check" />}
      {text}
    </span>
  );
}
