"use client";

// Part checkpoint (ADR-0021, design-system §5.4): intro → questions → drill → result.
import Link from "next/link";
import { useMemo, useState } from "react";
import { CHECKPOINT_PASS_MARK, pickDrill, seedFor, selectQuestions } from "@/lib/checkpoint";
import { localDay } from "@/lib/dates";
import { DRILL_MIN_CHARS, XP } from "@/lib/engagement";
import type { LearnerState } from "@/lib/learner-state";
import { Icon } from "./icons";
import { useLearner } from "./learner/provider";

export interface CheckpointCard {
  key: string;
  text: string;
  number?: number;
  href: string;
}
export interface CheckpointDrill {
  pageKey: string;
  number?: number;
  title: string;
  scenarioHtml: string;
}

type Phase = "intro" | "questions" | "drill" | "sending" | "result";

export function CheckpointFlow({
  course,
  part,
  partTitle,
  routeHref,
  cards,
  drills,
}: {
  course: string;
  part: number;
  partTitle: string;
  routeHref: string;
  cards: CheckpointCard[];
  drills: CheckpointDrill[];
}) {
  const { status, state, acceptServerState, notify } = useLearner();
  const record = state.checkpoints[String(part)];
  const attempt = (record?.attempts ?? 0) + 1;
  const nextQuestions = useMemo(
    () => selectQuestions(cards, seedFor(part, attempt)),
    [cards, part, attempt],
  );
  // Frozen at Start: saving the attempt bumps the attempt count, which must not change the
  // questions or drill the learner is looking at.
  const [run, setRun] = useState<{ questions: CheckpointCard[]; drill?: CheckpointDrill } | null>(
    null,
  );
  const questions = run?.questions ?? nextQuestions;
  const drill = run ? run.drill : pickDrill(drills, attempt);
  const [phase, setPhase] = useState<Phase>("intro");
  const [index, setIndex] = useState(0);
  const [ratings, setRatings] = useState<Record<string, "confident" | "unsure">>({});
  const [answer, setAnswer] = useState("");
  const [result, setResult] = useState<{ score: number; passed: boolean; xp: number } | null>(null);
  const [error, setError] = useState("");
  const focus = (id: string) => requestAnimationFrame(() => document.getElementById(id)?.focus());

  if (status === "loading") return <p className="muted">Loading…</p>;

  if (phase === "intro")
    return (
      <div className="card" style={{ display: "grid", gap: 12 }}>
        <div className="card-kicker">
          Part {part} checkpoint · attempt {attempt}
        </div>
        <h2 style={{ margin: 0 }}>{partTitle}</h2>
        <p style={{ margin: 0 }}>
          {questions.length} interview questions from this part, then one decision drill. Answer
          each question out loud or on paper, then rate yourself honestly.
        </p>
        <ul className="feed">
          <li>
            <span>Pass mark</span>
            <strong>{CHECKPOINT_PASS_MARK}% confident and the drill answered</strong>
          </li>
          <li>
            <span>Reward</span>
            <strong>{XP.checkpointPassed} XP (once)</strong>
          </li>
          <li>
            <span>Attempts</span>
            <strong>Unlimited, with a fresh set each time</strong>
          </li>
          {record && (
            <li>
              <span>Your best</span>
              <strong>
                {record.best}%{record.passed ? " · passed" : ""}
              </strong>
            </li>
          )}
        </ul>
        <p className="muted small" style={{ margin: 0 }}>
          Questions you mark unsure link back to their chapter and come back in your review queue
          tomorrow.
        </p>
        <button
          type="button"
          className="btn primary"
          onClick={() => {
            setRun({ questions: nextQuestions, drill: pickDrill(drills, attempt) });
            setPhase("questions");
            focus("cp-q");
          }}
        >
          Start checkpoint
        </button>
      </div>
    );

  if (phase === "questions") {
    const q = questions[index]!;
    const rate = (r: "confident" | "unsure") => {
      setRatings((x) => ({ ...x, [q.key]: r }));
      if (index + 1 < questions.length) {
        setIndex(index + 1);
        focus("cp-q");
      } else {
        setPhase("drill");
        focus("cp-drill");
      }
    };
    return (
      <>
        <div className="bar-track" aria-hidden="true">
          <div
            className="bar-fill"
            style={{ width: `${Math.round((index / (questions.length + 1)) * 100)}%` }}
          />
        </div>
        <div className="card flash">
          <div className="card-kicker">
            Question {index + 1} of {questions.length}
          </div>
          <div className="q" id="cp-q" tabIndex={-1}>
            {q.text}
          </div>
          {q.number !== undefined && <div className="muted small">From Chapter {q.number}</div>}
          <div className="rate">
            <button type="button" className="btn unsure" onClick={() => rate("unsure")}>
              Unsure
            </button>
            <button type="button" className="btn sure" onClick={() => rate("confident")}>
              Confident
            </button>
          </div>
        </div>
      </>
    );
  }

  if (phase === "drill" || phase === "sending")
    return (
      <>
        <article className="card m-decide">
          <div className="card-kicker">
            Final step · decision drill
            {drill?.number !== undefined ? ` from Chapter ${drill.number}` : ""}
          </div>
          <h3 id="cp-drill" tabIndex={-1}>
            {drill?.title}
          </h3>
          {drill && (
            <div
              className="prose"
              style={{ marginTop: 10 }}
              dangerouslySetInnerHTML={{ __html: drill.scenarioHtml }}
            />
          )}
        </article>
        <div className="card">
          <label htmlFor="cp-answer">
            <strong>Your answer</strong>
          </label>
          <textarea
            id="cp-answer"
            className="answer"
            style={{ marginTop: 8 }}
            placeholder="I would first ask…"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
          />
          <div className="pager" style={{ marginTop: 12 }}>
            <button
              type="button"
              className="btn primary"
              disabled={answer.trim().length < DRILL_MIN_CHARS || phase === "sending"}
              onClick={async () => {
                setPhase("sending");
                setError("");
                const res = await fetch("/api/me/checkpoints", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ course, part, day: localDay(), ratings, answer }),
                }).catch(() => null);
                if (!res || !res.ok) {
                  setPhase("drill");
                  setError(
                    res
                      ? "We couldn't save this attempt. Try again."
                      : "You're offline. Reconnect to finish the checkpoint.",
                  );
                  return;
                }
                const body = (await res.json()) as {
                  result: { score: number; passed: boolean; xp: number };
                  state: LearnerState;
                };
                setResult(body.result);
                acceptServerState(body.state);
                if (body.result.xp) notify(`+${body.result.xp} XP`);
                setPhase("result");
                focus("cp-result");
              }}
            >
              {phase === "sending" ? "Saving…" : "Finish checkpoint"}
            </button>
          </div>
          <p className="muted small" style={{ margin: "8px 0 0" }} aria-live="polite">
            {error ||
              (answer.trim().length < DRILL_MIN_CHARS
                ? `Write at least ${DRILL_MIN_CHARS} characters (${answer.trim().length}/${DRILL_MIN_CHARS}).`
                : "Ready to finish.")}
          </p>
        </div>
      </>
    );

  const unsure = questions.filter((q) => ratings[q.key] === "unsure");
  return (
    <>
      <div
        className="card result"
        style={{ textAlign: "center", display: "grid", gap: 10, justifyItems: "center" }}
      >
        <span style={{ color: result?.passed ? "var(--practise)" : "var(--decide)" }}>
          <Icon name={result?.passed ? "medal" : "flag"} />
        </span>
        <div className="big">{result?.score}%</div>
        <h2 id="cp-result" tabIndex={-1} style={{ margin: 0 }}>
          {result?.passed ? "Checkpoint passed" : "Not yet. You're close."}
        </h2>
        <p className="muted" style={{ margin: 0 }}>
          {result?.passed
            ? `You rated at least ${CHECKPOINT_PASS_MARK}% of questions confident and answered the drill.`
            : `Pass at ${CHECKPOINT_PASS_MARK}% confident with the drill answered. Revisit the questions below, then try again with a fresh set.`}
        </p>
        {result?.passed && (
          <p className="small" style={{ margin: 0 }}>
            Your Part certificate unlocks once every chapter in this part is complete.
          </p>
        )}
      </div>
      {unsure.length > 0 && (
        <div className="card">
          <div className="card-kicker" style={{ color: "var(--decide)" }}>
            To revisit ({unsure.length})
          </div>
          <ul className="feed" style={{ marginTop: 8 }}>
            {unsure.map((q) => (
              <li key={q.key}>
                <span>{q.text}</span>
                <Link href={q.href} style={{ whiteSpace: "nowrap" }}>
                  Chapter {q.number}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="pager">
        <Link className="btn" href={routeHref}>
          Back to your route
        </Link>
        {!result?.passed && (
          <button
            type="button"
            className="btn primary"
            onClick={() => {
              setRun(null);
              setPhase("intro");
              setIndex(0);
              setRatings({});
              setAnswer("");
              setResult(null);
            }}
          >
            Try again
          </button>
        )}
      </div>
    </>
  );
}
