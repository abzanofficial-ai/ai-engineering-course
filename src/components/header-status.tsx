"use client";

import Link from "next/link";
import { Icon } from "./icons";
import { useLearner } from "./learner/provider";

/** Streak and XP chip (ADR-0019), or a sign-in link for visitors. */
export function HeaderStatus() {
  const { status, state } = useLearner();
  if (status === "loading") return <span className="me me-placeholder" aria-hidden="true" />;
  if (status === "anon")
    return (
      <Link className="me" href="/sign-in">
        Sign in
      </Link>
    );
  // The accessible name is built from the visible numbers plus hidden words (WCAG 2.5.3).
  return (
    <Link className="me" href="/progress">
      <span className="sr-only">Your progress: </span>
      <span className="f">
        <Icon name="flame" />
        <span>{state.streak.streak}</span>
        <span className="sr-only"> day streak, </span>
      </span>
      <span className="s">
        <Icon name="star" />
        <span>{state.xp.total}</span>
        <span className="sr-only"> XP</span>
      </span>
    </Link>
  );
}

/** Shown when a signed-out reader tries to tick, answer or rate something. */
export function AccountPrompt() {
  const { promptAccount, dismissPrompt } = useLearner();
  if (!promptAccount) return null;
  const next = typeof window !== "undefined" ? window.location.pathname : "/";
  return (
    <div className="account-prompt" role="dialog" aria-modal="false" aria-labelledby="ap-title">
      <div>
        <strong id="ap-title">Save your progress</strong>
        <p>Create a free account to keep your ticks, answers, XP and streak on every device.</p>
      </div>
      <div className="ap-actions">
        <Link className="btn primary" href={`/sign-in?next=${encodeURIComponent(next)}`}>
          Create free account
        </Link>
        <button type="button" className="btn" onClick={dismissPrompt}>
          Not now
        </button>
      </div>
    </div>
  );
}
