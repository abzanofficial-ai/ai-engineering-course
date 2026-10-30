"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import { defaultBranding as brand } from "@/lib/branding";
import { partHue } from "@/lib/hues";
import { averageProgress, pageProgress } from "@/lib/learner-state";
import { formatLab, type RouteData, type RoutePage } from "@/lib/route-data";
import { Icon } from "./icons";
import { useLearner } from "./learner/provider";

const href = (course: string, p: Pick<RoutePage, "slug">) => `/learn/${course}/${p.slug}`;
const vars = (v: Record<string, string | number>) => v as CSSProperties;

/** Course home: hero with live progress, then the route of parts (design-system §5.1). */
export function RouteView({ data }: { data: RouteData }) {
  const { status, state } = useLearner();
  const signedIn = status === "ready";
  const allPages = data.parts.flatMap((p) => p.pages);
  const published = allPages.filter((p) => p.status === "published");
  const partPct = (pages: RoutePage[]) =>
    averageProgress(
      pages.filter((p) => p.status === "published").map((p) => p.spec),
      state,
    );
  const coursePct = (() => {
    const vals = data.parts.map((p) => partPct(p.pages)).filter((v): v is number => v !== null);
    return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0;
  })();
  const last = state.last && published.find((p) => p.key === state.last!.pageKey);
  const target = last ?? published[0]!;
  const week = state.week;

  return (
    <div className="wrap">
      <section className="hero" aria-labelledby="title">
        <h1 id="title">{data.title}</h1>
        <p>{brand.homeIntro}</p>
        <div className="stats">
          <div className="stat">
            <b>{data.counts.chapters}</b>
            <span>chapters ready</span>
          </div>
          <div className="stat">
            <b>{data.counts.steps}</b>
            <span>lab steps</span>
          </div>
          <div className="stat">
            <b>{data.counts.drills}</b>
            <span>decision drills</span>
          </div>
          <div className="stat">
            <b>{data.counts.questions}</b>
            <span>interview questions</span>
          </div>
        </div>
        <Link className="continue" href={href(data.course, target)}>
          <div>
            <div className="k">{last ? "Continue where you left off" : "Start here"}</div>
            <div className="t">
              {target.label ? `${target.label} · ` : ""}
              {target.title}
            </div>
          </div>
          <span className="go">
            <Icon name="arrow" />
          </span>
        </Link>
        {signedIn ? (
          <div className="hero-progress">
            <Link className="hp" href="/progress">
              <span className="gring" style={vars({ "--p": coursePct })}>
                <i>{coursePct}%</i>
              </span>
              <span>
                <b>{coursePct}%</b>
                <span>course complete</span>
              </span>
            </Link>
            <Link className="hp" href="/progress">
              <span className="flame">
                <Icon name="flame" />
              </span>
              <span>
                <b>
                  {state.streak.streak} day{state.streak.streak === 1 ? "" : "s"}
                </b>
                <span>
                  {state.streak.activeToday
                    ? "streak, done today"
                    : state.streak.streak
                      ? "streak, learn today to keep it"
                      : "streak, start today"}
                </span>
              </span>
            </Link>
            <Link className="hp wide" href="/progress">
              <span
                className="gring"
                style={vars({ "--p": Math.min(100, Math.round((week.active / week.goal) * 100)) })}
              >
                <i>
                  {week.active}/{week.goal}
                </i>
              </span>
              <span>
                <b>
                  {week.active} of {week.goal}
                </b>
                <span>days this week</span>
              </span>
            </Link>
          </div>
        ) : null}
        {signedIn && state.due.length > 0 && (
          <Link className="hp review-due" href="/review">
            <span className="flame" style={{ color: "var(--review)" }}>
              <Icon name="review" />
            </span>
            <span>
              <b>
                {state.due.length} question{state.due.length === 1 ? "" : "s"} to review
              </b>
              <span>Spaced repetition keeps them fresh</span>
            </span>
          </Link>
        )}
        {status === "anon" ? (
          <p className="small">
            <Link href="/sign-in">Create a free account</Link> to save your progress, earn XP and
            keep a streak.
          </p>
        ) : null}
        <p className="small route-tools">
          <Link href="/search">
            <Icon name="search" /> Search the course
          </Link>
          <Link href={`/learn/${data.course}/glossary`}>
            <Icon name="tag" /> Glossary
          </Link>
        </p>
      </section>

      <h2 className="route-h">Your route</h2>
      <ol className="route">
        {data.parts.map((part) => {
          const live = part.pages.filter((p) => p.status === "published");
          const pct = partPct(part.pages) ?? 0;
          const chapters = part.pages.filter((p) => p.kind === "chapter").length;
          return (
            <li
              key={part.number}
              className={`station${live.length ? "" : " soon"}`}
              style={vars({ "--h": partHue(part.number), "--p": pct })}
            >
              <div className="stop" aria-hidden="true">
                <i>{part.number || "★"}</i>
              </div>
              <div>
                <div className="st-head">
                  <h3>
                    {part.number ? `Part ${part.number} · ` : ""}
                    {part.title} {!live.length && <span className="badge">Coming soon</span>}
                  </h3>
                  {part.outcomeHtml && (
                    <p className="outcome">
                      You can now: <span dangerouslySetInnerHTML={{ __html: part.outcomeHtml }} />
                    </p>
                  )}
                  {live.length > 0 && signedIn && (
                    <p className="outcome">
                      <span className="pct">{pct}%</span> complete
                      {part.number
                        ? ` · ${live.filter((p) => p.kind === "chapter").length} of ${chapters} chapters available`
                        : ""}
                    </p>
                  )}
                  {part.milestone && (
                    <span className="flag">
                      <Icon name="flag" /> Milestone
                    </span>
                  )}
                </div>
                {live.length ? (
                  <ul className="chapters">
                    {part.pages.map((p) => {
                      if (p.status !== "published")
                        return (
                          <li key={p.key} className="soon-list">
                            {p.number !== undefined
                              ? `${p.number}. `
                              : p.label
                                ? `${p.label}: `
                                : ""}
                            {p.title} <span className="badge">Coming soon</span>
                          </li>
                        );
                      const pr = pageProgress(p.spec, state);
                      const meta = [`${p.readingMinutes} min read`];
                      if (p.labMinutes) meta.push(`lab ${formatLab(p.labMinutes)}`);
                      return (
                        <li key={p.key}>
                          <Link
                            className="ch"
                            href={href(data.course, p)}
                            style={vars({ "--p": pr })}
                          >
                            <span className="n">{p.number ?? <Icon name="learn" />}</span>
                            <span>
                              <span className="tt">{p.title}</span>
                              <br />
                              <span className="meta">{meta.join(" · ")}</span>
                            </span>
                            {signedIn ? (
                              <span
                                className={`mini${pr === 100 ? " done" : ""}`}
                                role="img"
                                aria-label={`${pr}% complete`}
                              >
                                {pr === 100 && <Icon name="check" />}
                              </span>
                            ) : (
                              <Icon name="arrow" />
                            )}
                          </Link>
                        </li>
                      );
                    })}
                    {part.number > 0 && (
                      <li>
                        <Link
                          className={`check-card${state.checkpoints[String(part.number)]?.passed ? " passed" : ""}`}
                          href={`/learn/${data.course}/checkpoint/${part.number}`}
                        >
                          <span style={{ color: "var(--c)" }}>
                            <Icon
                              name={
                                state.checkpoints[String(part.number)]?.passed ? "medal" : "flag"
                              }
                            />
                          </span>
                          <span>
                            <span className="k">Part {part.number} checkpoint</span>
                            <br />
                            <span className="t">
                              {(() => {
                                const c = state.checkpoints[String(part.number)];
                                if (c?.passed) return `Passed · best ${c.best}% confident`;
                                if (c) return `Best ${c.best}% · try again`;
                                return "10 questions + 1 drill · pass at 80% confident";
                              })()}
                            </span>
                          </span>
                          <span style={{ marginLeft: "auto" }}>
                            <Icon name="arrow" />
                          </span>
                        </Link>
                      </li>
                    )}
                  </ul>
                ) : (
                  <p className="soon-list">{part.pages.map((p) => p.title).join(" · ")}</p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
