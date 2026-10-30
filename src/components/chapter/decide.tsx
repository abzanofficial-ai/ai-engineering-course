"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { DRILL_MIN_CHARS } from "@/lib/engagement";
import { useLearner } from "../learner/provider";
import { useChapter } from "./shell";

/** Answer first, then compare with the experienced engineer (design-system §3.4). */
export function DrillPanel({ reveal }: { reveal: ReactNode }) {
  const { pageKey } = useChapter();
  const { state, status, dispatch } = useLearner();
  const saved = state.drills[pageKey];
  const [answer, setAnswer] = useState<string | null>(null);
  const [revealedLocal, setRevealedLocal] = useState(false);
  const text = answer ?? saved?.answer ?? "";
  const revealed = revealedLocal || Boolean(saved?.revealed);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const len = text.trim().length;

  useEffect(() => () => void (debounce.current && clearTimeout(debounce.current)), []);

  const persist = (value: string, isRevealed: boolean) =>
    dispatch({ type: "drill", page: pageKey, answer: value, revealed: isRevealed });

  if (!revealed) {
    return (
      <div className="card">
        <label htmlFor="drill-answer">
          <strong>Your answer</strong>{" "}
          <span className="muted small">
            (private{status === "ready" ? ", saved as you type" : ""})
          </span>
        </label>
        <p className="muted small" style={{ margin: "4px 0 10px" }}>
          What would you ask first, and what would you recommend? Write it before you look.
        </p>
        <textarea
          id="drill-answer"
          className="answer"
          placeholder="I would first ask…"
          value={text}
          onChange={(e) => {
            const v = e.target.value;
            setAnswer(v);
            if (status === "ready") {
              if (debounce.current) clearTimeout(debounce.current);
              debounce.current = setTimeout(() => persist(v, false), 800);
            }
          }}
        />
        <div className="pager" style={{ marginTop: 12 }}>
          <button
            type="button"
            className="btn primary"
            disabled={len < DRILL_MIN_CHARS}
            onClick={() => {
              setRevealedLocal(true);
              persist(text, true);
              requestAnimationFrame(() => document.getElementById("reveal")?.focus());
            }}
          >
            Compare with an experienced engineer
          </button>
        </div>
        <p className="muted small" style={{ margin: "8px 0 0" }} aria-live="polite">
          {len < DRILL_MIN_CHARS
            ? `Write at least ${DRILL_MIN_CHARS} characters to compare (${len}/${DRILL_MIN_CHARS}).`
            : "Ready when you are."}
        </p>
        <button
          type="button"
          className="link-btn"
          onClick={() => {
            setRevealedLocal(true);
            persist(text, true);
          }}
        >
          Skip and reveal
        </button>
      </div>
    );
  }
  return (
    <>
      <div className="compare">
        <div className="yours">
          <div className="card-kicker" style={{ color: "var(--muted)" }}>
            Your answer
          </div>
          {text ? text : <span className="muted">You skipped this one.</span>}
        </div>
        <article className="card" id="reveal" tabIndex={-1}>
          <div className="card-kicker">How an experienced engineer reasons</div>
          <div className="prose" style={{ marginTop: 10 }}>
            {reveal}
          </div>
        </article>
      </div>
      <button
        type="button"
        className="link-btn"
        onClick={() => {
          setRevealedLocal(false);
          persist(text, false);
          requestAnimationFrame(() => document.getElementById("drill-answer")?.focus());
        }}
      >
        Edit my answer
      </button>
    </>
  );
}
