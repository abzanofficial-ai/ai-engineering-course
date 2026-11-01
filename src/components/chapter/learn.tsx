"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Icon } from "../icons";
import { SectionTools } from "../section-tools";
import { useLearner } from "../learner/provider";
import { SaveStatus, useChapter } from "./shell";

export function LearnHeader({ titles }: { titles: string[] }) {
  const { learnKeys, learnIndex, setLearnIndex, pageKey } = useChapter();
  const { state, status } = useLearner();
  const read = new Set(state.read[pageKey] ?? []);
  const pct = learnKeys.length
    ? Math.round((learnKeys.filter((k) => read.has(k)).length / learnKeys.length) * 100)
    : 0;
  return (
    <>
      <div className="mode-head">
        <Icon name="learn" />
        <h2>Learn</h2>
        {status === "ready" ? (
          <span className="muted small" style={{ marginLeft: "auto" }}>
            {pct}% read
          </span>
        ) : null}
      </div>
      {status === "ready" && (
        <div className="bar-track" aria-hidden="true">
          <div className="bar-fill" style={{ width: `${pct}%` }} />
        </div>
      )}
      <ol className="dots" aria-label="Sections">
        {learnKeys.map((k, i) => (
          <li key={k}>
            <button
              type="button"
              className={`dot${read.has(k) ? " read" : ""}`}
              aria-current={i === learnIndex ? "step" : undefined}
              aria-label={`Section ${i + 1}: ${titles[i]}${read.has(k) ? " (read)" : ""}`}
              onClick={() => setLearnIndex(i)}
            >
              {i + 1}
            </button>
          </li>
        ))}
      </ol>
    </>
  );
}

export function LearnCard({
  index,
  sectionKey,
  kicker,
  title,
  children,
}: {
  index: number;
  sectionKey: string;
  kicker: string;
  title: string;
  children: ReactNode;
}) {
  const { learnIndex, pageKey } = useChapter();
  return (
    <article
      className="card"
      id={sectionKey}
      hidden={index !== learnIndex}
      aria-labelledby={index === learnIndex ? "learn-title" : undefined}
    >
      <div className="card-kicker">{kicker}</div>
      <h3 id={index === learnIndex ? "learn-title" : undefined} tabIndex={-1}>
        {title}
      </h3>
      <div style={{ marginTop: 14 }}>{children}</div>
      <SectionTools pageKey={pageKey} sectionKey={sectionKey} title={title} />
    </article>
  );
}

export function LearnPager({
  hasPractise,
  next,
  courseHref,
}: {
  hasPractise: boolean;
  next?: { href: string; title: string };
  courseHref: string;
}) {
  const { learnKeys, learnIndex, setLearnIndex, pageKey, setMode } = useChapter();
  const { dispatch, state, status } = useLearner();
  const [finished, setFinished] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const last = learnIndex >= learnKeys.length - 1;
  const read = new Set(state.read[pageKey] ?? []);
  const unread = learnKeys.filter((k) => !read.has(k));

  useEffect(() => {
    if (finished) heading.current?.focus();
  }, [finished]);

  // A chapter without a lab ends here: say so, and offer what comes next.
  if (finished && last && !hasPractise) {
    const firstUnread = learnKeys.indexOf(unread[0] ?? "");
    return (
      <section className="chapter-done" aria-labelledby="chapter-done-h">
        <div className="chapter-done-icon" aria-hidden="true">
          <Icon name="check" />
        </div>
        <h3 id="chapter-done-h" ref={heading} tabIndex={-1}>
          {status === "ready" && unread.length === 0 ? "Chapter complete" : "End of this chapter"}
        </h3>
        <p>
          {status !== "ready"
            ? "Create a free account to save your reading and earn XP."
            : unread.length === 0
              ? `You've read all ${learnKeys.length} sections.`
              : `${unread.length} earlier section${unread.length === 1 ? " isn't" : "s aren't"} marked as read yet.`}
        </p>
        <div className="chapter-done-actions">
          {next && (
            <Link className="btn primary" href={next.href}>
              Next: {next.title} <Icon name="arrow" />
            </Link>
          )}
          {status === "ready" && firstUnread >= 0 && (
            <button
              type="button"
              className="btn"
              onClick={() => {
                setFinished(false);
                setLearnIndex(firstUnread);
              }}
            >
              Go to the first unread section
            </button>
          )}
          <Link className="btn" href={courseHref}>
            Back to the course
          </Link>
        </div>
        <SaveStatus />
      </section>
    );
  }

  return (
    <div className="pager">
      <button
        type="button"
        className="btn"
        disabled={learnIndex === 0}
        onClick={() => setLearnIndex(learnIndex - 1)}
      >
        Back
      </button>
      <button
        type="button"
        className="btn primary"
        onClick={() => {
          dispatch({ type: "section_read", page: pageKey, section: learnKeys[learnIndex]! });
          if (!last) setLearnIndex(learnIndex + 1);
          else if (hasPractise) setMode("practise", true);
          else setFinished(true);
        }}
      >
        {last ? (hasPractise ? "Finish · go to Practise" : "Mark as read") : "Got it · next"}
      </button>
      <SaveStatus />
    </div>
  );
}

export function TermCard({ term, children }: { term: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <button type="button" className="term" aria-expanded={open} onClick={() => setOpen(!open)}>
      <b>{term}</b>
      <span className="meaning" hidden={!open}>
        {children}
      </span>
      <span className="hint" hidden={open}>
        Tap to reveal
      </span>
    </button>
  );
}

export function RevealAllTerms() {
  return (
    <button
      type="button"
      className="link-btn"
      onClick={(e) => {
        const grid = (e.currentTarget.previousElementSibling as HTMLElement | null) ?? document;
        grid
          .querySelectorAll<HTMLButtonElement>(".term[aria-expanded='false']")
          .forEach((b) => b.click());
      }}
    >
      Show all meanings
    </button>
  );
}
