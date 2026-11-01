"use client";

// Spaced-repetition review across the course (ADR-0016): every question due now, one at a
// time. Rating schedules the next review (unsure → tomorrow; confident → a longer gap).
import Link from "next/link";
import { useState } from "react";
import { useLearner } from "./learner/provider";

export interface ReviewCard {
  key: string;
  text: string;
  number?: number;
  href: string;
}

export function ReviewQueue({ cards, routeHref }: { cards: ReviewCard[]; routeHref: string }) {
  const { status, state, dispatch } = useLearner();
  const [done, setDone] = useState(0);
  if (status === "loading") return <p className="muted">Loading your review queue…</p>;
  const byKey = new Map(cards.map((c) => [c.key, c]));
  const queue = state.due.map((k) => byKey.get(k)).filter((c): c is ReviewCard => !!c);
  const card = queue[0];

  if (!card)
    return (
      <div className="card flash">
        <div className="q">
          {done ? `All caught up: ${done} reviewed.` : "Nothing to review right now."}
        </div>
        <p className="muted small" style={{ margin: 0 }}>
          Questions you mark unsure come back here after a day, then again at longer gaps as you
          grow confident.
        </p>
        <Link className="btn" href={routeHref}>
          Back to your route
        </Link>
      </div>
    );

  const rate = (rating: "confident" | "unsure") => {
    dispatch({ type: "card", card: card.key, rating });
    setDone(done + 1);
  };
  return (
    <>
      <div className="tally">
        <span>{queue.length} due</span>
        <span className="muted">{done} reviewed this session</span>
      </div>
      <div className="card flash">
        <div className="card-kicker">
          {card.number !== undefined ? `Chapter ${card.number}` : "Review"}
        </div>
        <div className="q" aria-live="polite">
          {card.text}
        </div>
        <p className="muted small" style={{ margin: 0 }}>
          Answer out loud, then rate yourself. <Link href={card.href}>Open the chapter</Link>
        </p>
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
