"use client";

import { useState } from "react";
import { useLearner } from "../learner/provider";

/** Interview practice as flashcards; ratings feed spaced repetition (ADR-0016). */
export function Flashcards({ cards }: { cards: { key: string; text: string }[] }) {
  const { state, dispatch } = useLearner();
  const [index, setIndex] = useState(0);
  const [onlyUnsure, setOnlyUnsure] = useState(false);
  const pool = onlyUnsure ? cards.filter((c) => state.cards[c.key] === "unsure") : cards;
  const sure = cards.filter((c) => state.cards[c.key] === "confident").length;
  const unsure = cards.filter((c) => state.cards[c.key] === "unsure").length;

  return (
    <>
      <div className="tally">
        <span style={{ color: "var(--practise)" }}>Confident {sure}</span>
        <span style={{ color: "var(--decide)" }}>Unsure {unsure}</span>
        <span className="muted">Not rated {cards.length - sure - unsure}</span>
      </div>
      {pool.length === 0 ? (
        <div className="card flash">
          <div className="q">No unsure questions left.</div>
          <button type="button" className="btn" onClick={() => setOnlyUnsure(false)}>
            Practise all questions
          </button>
        </div>
      ) : (
        (() => {
          const i = index % pool.length;
          const c = pool[i]!;
          const rate = (rating: "confident" | "unsure") => {
            dispatch({ type: "card", card: c.key, rating });
            if (!(onlyUnsure && rating === "confident")) setIndex(index + 1);
          };
          return (
            <>
              <div className="card flash">
                <div className="card-kicker">
                  Question {i + 1} of {pool.length}
                  {state.cards[c.key] ? ` · rated ${state.cards[c.key]}` : ""}
                </div>
                <div className="q" aria-live="polite">
                  {c.text}
                </div>
                <p className="muted small" style={{ margin: 0 }}>
                  Answer out loud as if you were in the interview, then rate yourself.
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
              <div className="pager">
                <button
                  type="button"
                  className="btn"
                  onClick={() => setIndex(Math.max(0, index - 1))}
                >
                  Previous
                </button>
                <button type="button" className="btn" onClick={() => setIndex(index + 1)}>
                  Skip
                </button>
              </div>
            </>
          );
        })()
      )}
      {unsure > 0 && (
        <button
          type="button"
          className="link-btn"
          onClick={() => (setOnlyUnsure(!onlyUnsure), setIndex(0))}
        >
          {onlyUnsure
            ? "Practise all questions"
            : `Practise only the ${unsure} unsure question${unsure > 1 ? "s" : ""}`}
        </button>
      )}
      <p className="muted small">
        Questions you mark unsure come back for review after 1 day, then 3, 7, 14 and 30 days as you
        grow confident.
      </p>
    </>
  );
}
