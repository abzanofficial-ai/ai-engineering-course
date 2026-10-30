"use client";

// The learner's home (ADR-0028): this week's activity, what to do next, every course they can
// take with live progress, and a side column with the next checkpoint and chapters in progress.
// Courses come from content/courses.json, so new ones appear here.
import Link from "next/link";
import { useEffect, useState } from "react";
import type { DashboardCourse } from "@/lib/dashboard-data";
import { localDay } from "@/lib/dates";
import {
  averageProgress,
  courseProgress,
  emptyState,
  pageProgress,
  type LearnerState,
} from "@/lib/learner-state";
import { ActivityChart } from "./activity-chart";
import { Icon } from "./icons";
import { useLearner } from "./learner/provider";

/** The provider holds the default course; other courses are fetched once for their card. */
function useCourseState(slug: string, providerCourse: string): LearnerState | null {
  const { status, state } = useLearner();
  const [other, setOther] = useState<LearnerState | null>(null);
  const own = slug === providerCourse;
  useEffect(() => {
    if (own || status !== "ready") return;
    let live = true;
    fetch(`/api/me/state?course=${encodeURIComponent(slug)}&day=${localDay()}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((b: { state?: LearnerState } | null) => {
        if (live && b?.state) setOther({ ...emptyState(), ...b.state });
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [own, slug, status]);
  if (status !== "ready") return null;
  return own ? state : other;
}

const pageName = (p: { label: string; title: string }) =>
  p.label ? `${p.label}: ${p.title}` : p.title;

function Ring({ pct, label }: { pct: number; label: string }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  return (
    <svg className="ring" viewBox="0 0 64 64" role="img" aria-label={label}>
      <circle cx="32" cy="32" r={r} className="ring-track" />
      {pct > 0 && (
        <circle
          cx="32"
          cy="32"
          r={r}
          className="ring-fill"
          strokeDasharray={`${(pct / 100) * c} ${c}`}
          transform="rotate(-90 32 32)"
        />
      )}
      <text x="32" y="37" textAnchor="middle">
        {pct}%
      </text>
    </svg>
  );
}

function CourseCard({
  course,
  providerCourse,
}: {
  course: DashboardCourse;
  providerCourse: string;
}) {
  const state = useCourseState(course.slug, providerCourse);
  const pct = state ? courseProgress(course.parts, state) : 0;
  const lastSlug = state?.last ? course.slugs[state.last.pageKey] : undefined;
  const started = Boolean(state && (pct > 0 || lastSlug));
  const href = lastSlug ? `/learn/${course.slug}/${lastSlug}` : `/learn/${course.slug}`;
  const titleId = `course-${course.slug}`;
  return (
    <article className="course-card" aria-labelledby={titleId}>
      <div className="course-art" aria-hidden="true">
        <Icon name={course.icon} />
      </div>
      <div className="course-body">
        {course.level && <span className="level">{course.level}</span>}
        <h3 id={titleId}>
          <Link href={`/learn/${course.slug}`}>{course.title}</Link>
        </h3>
        {course.summary && <p className="course-summary">{course.summary}</p>}
        <p className="course-meta">
          {course.counts.chapters} chapters ready · {course.counts.labs} labs
          {course.counts.comingSoon > 0 && ` · ${course.counts.comingSoon} coming soon`}
        </p>
        {state && (
          <div className="course-progress">
            <div
              className="bar-track"
              role="progressbar"
              aria-label={`${course.title} progress`}
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div className="bar-fill" style={{ width: `${pct}%` }} />
            </div>
            <span>{pct === 0 && started ? "Just started" : `${pct}% complete`}</span>
          </div>
        )}
      </div>
      <Link
        className="btn primary course-go"
        href={href}
        aria-label={`${started ? "Continue" : "Start course"}: ${course.title}`}
      >
        {started ? "Continue" : "Start course"}
        <Icon name="arrow" />
      </Link>
    </article>
  );
}

/** "Up next": where the learner left off, and what is waiting for them. */
function UpNext({ course, state }: { course: DashboardCourse; state: LearnerState }) {
  const specs = new Map(course.parts.flat().map((s) => [s.key, s]));
  const last = state.last && course.pages.find((p) => p.key === state.last!.pageKey);
  const lastIdx = last ? course.pages.indexOf(last) : -1;
  const next = course.pages
    .slice(lastIdx + 1)
    .find((p) => pageProgress(specs.get(p.key)!, state) < 100);
  const items = [
    last && {
      key: "continue",
      tag: "Continue",
      title: pageName(last),
      href: `/learn/${course.slug}/${last.slug}`,
      icon: "learn",
    },
    state.due.length > 0
      ? {
          key: "review",
          tag: "Review",
          title: `${state.due.length} question${state.due.length === 1 ? "" : "s"} due`,
          href: "/review",
          icon: "review",
        }
      : next && {
          key: "next",
          tag: "Up next",
          title: pageName(next),
          href: `/learn/${course.slug}/${next.slug}`,
          icon: "arrow",
        },
  ].filter(Boolean) as { key: string; tag: string; title: string; href: string; icon: string }[];
  if (!items.length) return null;
  return (
    <ul className="up-next" aria-label="Up next">
      {items.map((it) => (
        <li key={it.key}>
          <Link href={it.href} className="up-item">
            <span className="up-tag">{it.tag}</span>
            <span className="up-title">{it.title}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function Dashboard({
  courses,
  providerCourse,
  intro,
}: {
  courses: DashboardCourse[];
  providerCourse: string;
  intro: string;
}) {
  const { status, state, user } = useLearner();
  const signedIn = status === "ready";
  const [deleted, setDeleted] = useState(false);
  useEffect(() => {
    // Shown once after "Delete my account" sends the learner here.
    if (new URLSearchParams(window.location.search).get("deleted") === "1") {
      setDeleted(true); // eslint-disable-line react-hooks/set-state-in-effect
      window.history.replaceState(null, "", "/");
    }
  }, []);
  const main = `/learn/${providerCourse}`;
  const firstName = user?.name?.split(" ")[0];
  const course = courses.find((c) => c.slug === providerCourse) ?? courses[0]!;
  const specs = new Map(course.parts.flat().map((s) => [s.key, s]));
  const pct = courseProgress(course.parts, state);

  // The next part checkpoint not yet passed (ADR-0021), as the side column's call to action.
  const nextCheckpoint = course.partNumbers
    .map((n, i) => ({ n, pct: averageProgress(course.parts[i]!, state) ?? 0 }))
    .find(({ n }) => n > 0 && !state.checkpoints[String(n)]?.passed);

  // Chapters in progress first, then the next ones not started.
  const inProgress = course.pages.filter((p) => {
    const v = pageProgress(specs.get(p.key)!, state);
    return v > 0 && v < 100;
  });
  const fresh = course.pages.filter((p) => pageProgress(specs.get(p.key)!, state) === 0);
  const chapterList = [...inProgress, ...fresh].slice(0, 4);

  const nav = [
    { href: "/", label: "Home", icon: "courses", current: true },
    { href: main, label: "Learning path", icon: "path" },
    { href: "/progress", label: "My progress", icon: "chart" },
    { href: "/review", label: "Review due", icon: "review" },
    { href: "/notes", label: "Notes and bookmarks", icon: "note" },
    { href: `${main}/glossary`, label: "Glossary", icon: "tag" },
  ] as const;

  return (
    <div className="wrap dash">
      <nav className="dash-nav" aria-label="Your learning">
        <ul>
          {nav.map((n) => (
            <li key={n.href}>
              <Link
                className="dash-link"
                href={n.href}
                aria-current={"current" in n ? "page" : undefined}
              >
                <Icon name={n.icon} /> {n.label}
              </Link>
            </li>
          ))}
          <li>
            <Link className="dash-link" href="/certificates">
              <Icon name="medal" /> Certificates
            </Link>
          </li>
        </ul>
      </nav>

      <main id="main" className="dash-main">
        {deleted && (
          <p className="notice" role="status">
            Your account and all your learning data have been deleted.
          </p>
        )}
        <header className="dash-head">
          <div>
            <h1>{signedIn ? "Home" : "Your courses"}</h1>
            <p>{signedIn ? `Welcome back${firstName ? `, ${firstName}` : ""}!` : intro}</p>
          </div>
          {signedIn && (
            <dl className="dash-kpis">
              <div>
                <dt>
                  <Icon name="flame" /> Streak
                </dt>
                <dd>
                  {state.streak.streak} day{state.streak.streak === 1 ? "" : "s"}
                </dd>
              </div>
              <div>
                <dt>
                  <Icon name="star" /> XP
                </dt>
                <dd>{state.xp.total}</dd>
              </div>
              <div>
                <dt>
                  <Icon name="check" /> This week
                </dt>
                <dd>
                  {state.week.active}/{state.week.goal} days
                </dd>
              </div>
            </dl>
          )}
        </header>

        {signedIn && (
          <section className="panel activity-panel" aria-labelledby="activity-h">
            <div className="panel-head">
              <h2 id="activity-h">My activity</h2>
              <Link href="/progress" className="see-all">
                See all <Icon name="arrow" />
              </Link>
            </div>
            <div className="activity-grid">
              <ActivityChart days={state.week.days} today={localDay()} />
              <UpNext course={course} state={state} />
            </div>
          </section>
        )}

        <section aria-labelledby="courses-h" className="dash-courses">
          <div className="panel-head">
            <h2 id="courses-h">{courses.length === 1 ? "Your course" : "Courses"}</h2>
          </div>
          {courses.map((c) => (
            <CourseCard key={c.slug} course={c} providerCourse={providerCourse} />
          ))}
        </section>
      </main>

      <aside className="dash-rail" aria-label="Next steps">
        {signedIn && nextCheckpoint ? (
          <Link className="cta-card" href={`${main}/checkpoint/${nextCheckpoint.n}`}>
            <span className="cta-text">Test yourself on Part {nextCheckpoint.n}</span>
            <span className="cta-btn">Take the checkpoint</span>
          </Link>
        ) : !signedIn ? (
          <Link className="cta-card" href="/sign-in">
            <span className="cta-text">Save your progress on every device</span>
            <span className="cta-btn">Create a free account</span>
          </Link>
        ) : null}

        {signedIn && (
          <div className="panel ring-card">
            <div>
              <h2 className="ring-title">{course.title}</h2>
              <p className="muted small">
                {course.counts.chapters} chapters · goal {state.week.goal} days a week
              </p>
            </div>
            <Ring pct={pct} label={`${pct}% of the course complete`} />
          </div>
        )}

        <section className="panel chapter-list" aria-labelledby="chapters-h">
          <div className="panel-head">
            <h2 id="chapters-h">{inProgress.length ? "Your chapters" : "Start here"}</h2>
            <Link href={main} className="see-all">
              All <Icon name="arrow" />
            </Link>
          </div>
          <ul>
            {chapterList.map((p) => {
              const spec = specs.get(p.key)!;
              const v = pageProgress(spec, state);
              return (
                <li key={p.key}>
                  <Link href={`${main}/${p.slug}`} className="chapter-row">
                    <span className="chapter-row-text">
                      <span className="chapter-row-title">{pageName(p)}</span>
                      <span className="chapter-row-meta">
                        {spec.learn.length} sections
                        {spec.labs.length > 0 &&
                          ` · ${spec.labs.length} lab${spec.labs.length === 1 ? "" : "s"}`}
                        {signedIn && v > 0 ? ` · ${v}%` : ""}
                      </span>
                    </span>
                    <Icon name="arrow" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      </aside>
    </div>
  );
}
