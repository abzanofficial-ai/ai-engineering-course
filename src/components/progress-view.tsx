"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import { XP } from "@/lib/engagement";
import { partHue } from "@/lib/hues";
import { averageProgress } from "@/lib/learner-state";
import type { RouteData } from "@/lib/route-data";
import { Icon } from "./icons";
import { useLearner } from "./learner/provider";

const DOW = ["M", "T", "W", "T", "F", "S", "S"];

function ago(iso: string): string {
  const m = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  if (m < 1440) return `${Math.round(m / 60)} h ago`;
  return `${Math.round(m / 1440)} d ago`;
}

/** Your progress (design-system §5.3). */
export function ProgressView({ data }: { data: RouteData }) {
  const { status, state, dispatch } = useLearner();
  if (status === "loading")
    return <div className="wrap panel-wrap muted">Loading your progress…</div>;
  if (status === "anon")
    return (
      <div className="wrap panel-wrap">
        <p>
          <Link href="/sign-in?next=/progress">Sign in</Link> to see your progress.
        </p>
      </div>
    );
  const parts = data.parts
    .map((p) => ({
      ...p,
      pct: averageProgress(
        p.pages.filter((x) => x.status === "published").map((x) => x.spec),
        state,
      ),
    }))
    .filter((p) => p.pct !== null);
  const course = parts.length
    ? Math.round(parts.reduce((n, p) => n + p.pct!, 0) / parts.length)
    : 0;
  const { streak, week, xp } = state;
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  return (
    <div className="wrap panel-wrap m-practise">
      <Link className="back" href={`/learn/${data.course}`}>
        <Icon name="back" /> Your route
      </Link>
      <h1 style={{ margin: 0, fontSize: "2rem" }}>Your progress</h1>
      <div className="grid2">
        <div className="card">
          <div className="card-kicker" style={{ color: "var(--muted)" }}>
            Course
          </div>
          <div className="big">{course}%</div>
          <div className="bar-track" style={{ marginTop: 10 }}>
            <div className="bar-fill" style={{ width: `${course}%` }} />
          </div>
        </div>
        <div className="card">
          <div className="card-kicker" style={{ color: "var(--star)" }}>
            XP
          </div>
          <div className="big">{xp.total}</div>
          <div className="muted small">{xp.week} this week</div>
        </div>
        <div className="card">
          <div className="card-kicker" style={{ color: "var(--flame)" }}>
            Streak
          </div>
          <div className="big">
            {streak.streak} <span className="small muted">day{streak.streak === 1 ? "" : "s"}</span>
          </div>
          <div className="muted small">
            {streak.activeToday ? "Done today. " : "Learn anything today to keep it going. "}
            {streak.freezesLeft
              ? `${streak.freezesLeft} streak freeze${streak.freezesLeft > 1 ? "s" : ""} ready.`
              : "Earn a streak freeze every 7 days."}
          </div>
        </div>
      </div>

      <section className="card" aria-labelledby="goal-h">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div>
            <div className="card-kicker" id="goal-h">
              Weekly goal
            </div>
            <strong>
              {week.active} of {week.goal} days this week
            </strong>
          </div>
          <div className="stepper" role="group" aria-label="Weekly goal in days">
            <button
              type="button"
              aria-label="Fewer days"
              disabled={week.goal <= 1}
              onClick={() => dispatch({ type: "goal", weeklyGoal: week.goal - 1 })}
            >
              −
            </button>
            <b aria-live="polite">{week.goal}</b>
            <button
              type="button"
              aria-label="More days"
              disabled={week.goal >= 7}
              onClick={() => dispatch({ type: "goal", weeklyGoal: week.goal + 1 })}
            >
              +
            </button>
          </div>
        </div>
        <ol className="week" aria-label="This week">
          {week.days.map((d, i) => (
            <li
              key={d.day}
              className={`wd${d.active ? " on" : ""}${d.day === todayKey ? " today" : ""}`}
            >
              <i aria-hidden="true">{d.active ? "✓" : ""}</i>
              <span>
                {DOW[i]}
                <span className="sr-only">{d.active ? " active" : " not active"}</span>
              </span>
            </li>
          ))}
        </ol>
        <p className="muted small" style={{ margin: "10px 0 0" }}>
          Three days a week is a good pace alongside a job. Any XP you earn counts as a learning
          day.
        </p>
      </section>

      <section className="card" aria-labelledby="parts-h">
        <div className="card-kicker" id="parts-h" style={{ color: "var(--muted)" }}>
          Parts
        </div>
        <ul className="feed" style={{ marginTop: 8 }}>
          {parts.map((p) => (
            <li
              key={p.number}
              style={{ "--c": `hsl(${partHue(p.number)} var(--ps) var(--pl))` } as CSSProperties}
            >
              <span>
                {p.number ? `Part ${p.number} · ` : ""}
                {p.title}
              </span>
              <span className="pct">{p.pct}%</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="card" aria-labelledby="xp-h">
        <div className="card-kicker" id="xp-h" style={{ color: "var(--star)" }}>
          Recent XP
        </div>
        {xp.recent.length ? (
          <ul className="feed" style={{ marginTop: 8 }}>
            {xp.recent.map((e, i) => (
              <li key={i}>
                <span>
                  {e.label} <span className="muted">· {ago(e.at)}</span>
                </span>
                <b>+{e.points}</b>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted small">
            No XP yet. Read a section, tick a lab step or rate a flashcard to earn your first
            points.
          </p>
        )}
        <p className="muted small" style={{ margin: "10px 0 0" }}>
          Section read {XP.sectionRead} · lab step {XP.labStep} · lab committed {XP.labCommitted} ·
          drill answered {XP.drillAnswered} · flashcard {XP.cardRated} · part checkpoint{" "}
          {XP.checkpointPassed}. Each item earns XP once.
        </p>
      </section>

      <section className="card" aria-labelledby="rem-h">
        <div className="card-kicker" id="rem-h" style={{ color: "var(--muted)" }}>
          Reminders
        </div>
        <p className="small" style={{ margin: "6px 0 0" }}>
          Weekly progress emails, streak reminders and phone notifications arrive in a later update.
          They will be off until you turn them on.
        </p>
      </section>
      <p className="small">
        <Link href="/account">Account settings, data download and deletion</Link>
      </p>
    </div>
  );
}
