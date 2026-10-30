"use client";

// The learner's home (ADR-0028): every course they can take, with live progress, and the
// places they return to. Courses come from content/courses.json, so new ones appear here.
import Link from "next/link";
import { useEffect, useState } from "react";
import type { DashboardCourse } from "@/lib/dashboard-data";
import { localDay } from "@/lib/dates";
import { courseProgress, emptyState, type LearnerState } from "@/lib/learner-state";
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

  const nav = [
    { href: "/", label: "Courses", icon: "courses", current: true },
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
            <span className="dash-soon" aria-disabled="true">
              <Icon name="medal" /> Certificates <small>soon</small>
            </span>
          </li>
        </ul>
        <div className="dash-aside">
          {signedIn ? (
            <p>
              Keep your streak going: <strong>{state.week.active}</strong> of{" "}
              <strong>{state.week.goal}</strong> learning days this week.
            </p>
          ) : (
            <p>
              <Link href="/sign-in">Create a free account</Link> to save progress, earn XP and keep
              a streak on every device.
            </p>
          )}
        </div>
      </nav>

      <main id="main" className="dash-main">
        {deleted && (
          <p className="notice" role="status">
            Your account and all your learning data have been deleted.
          </p>
        )}
        <header className="dash-head">
          <h1>{signedIn && firstName ? `Welcome back, ${firstName}` : "Your courses"}</h1>
          <p>{intro}</p>
        </header>

        <section aria-labelledby="courses-h" className="dash-courses">
          <h2 id="courses-h">
            <Icon name="courses" /> {courses.length === 1 ? "Your course" : "Courses"}
          </h2>
          {courses.map((c) => (
            <CourseCard key={c.slug} course={c} providerCourse={providerCourse} />
          ))}
        </section>

        {signedIn && (
          <section aria-label="This week" className="dash-stats">
            <Link href="/progress" className="dash-stat">
              <span className="flame">
                <Icon name="flame" />
              </span>
              <b>{state.streak.streak}</b>
              <span>day streak</span>
            </Link>
            <Link href="/progress" className="dash-stat">
              <span className="star">
                <Icon name="star" />
              </span>
              <b>{state.xp.total}</b>
              <span>XP earned</span>
            </Link>
            <Link href="/progress" className="dash-stat">
              <Icon name="check" />
              <b>
                {state.week.active}/{state.week.goal}
              </b>
              <span>days this week</span>
            </Link>
            <Link href="/review" className="dash-stat">
              <Icon name="review" />
              <b>{state.due.length}</b>
              <span>to review</span>
            </Link>
          </section>
        )}
      </main>
    </div>
  );
}
