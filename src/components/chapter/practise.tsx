"use client";

import type { CSSProperties, ReactNode } from "react";
import { useState } from "react";
import { Icon } from "../icons";
import { useLearner } from "../learner/provider";
import { useChapter } from "./shell";

function useLab(labKey: string) {
  const { pageKey, spec } = useChapter();
  const { state } = useLearner();
  const steps = spec.labs.find((l) => l.key === labKey)?.steps ?? [];
  const ticked = new Set(state.steps[pageKey]?.[labKey] ?? []);
  const committed = (state.commits[pageKey] ?? []).includes(labKey);
  return { pageKey, steps, ticked, committed };
}

export function LabRing({ labKey }: { labKey: string }) {
  const { steps, ticked } = useLab(labKey);
  const done = steps.filter((s) => ticked.has(s)).length;
  const pct = steps.length ? Math.round((done / steps.length) * 100) : 0;
  return (
    <div
      className="ring"
      style={{ "--p": pct } as CSSProperties}
      role="img"
      aria-label={`${done} of ${steps.length} steps done`}
    >
      <span>
        {done}/{steps.length}
      </span>
    </div>
  );
}

export function LabStep({
  labKey,
  stepKey,
  label,
  title,
  anchor,
  children,
}: {
  labKey: string;
  stepKey: string;
  label: string;
  title: string;
  anchor: string;
  children: ReactNode;
}) {
  const { pageKey, steps, ticked } = useLab(labKey);
  const { dispatch } = useLearner();
  const done = ticked.has(stepKey);
  const firstOpen = steps.find((s) => !ticked.has(s)) === stepKey;
  const [open, setOpen] = useState<boolean | null>(null);
  const isOpen = open ?? firstOpen;
  return (
    <div className={`step${done ? " done" : ""}`} id={anchor}>
      <div className="step-row">
        <button
          type="button"
          className="tick"
          role="checkbox"
          aria-checked={done}
          aria-label={`Step ${label} done`}
          onClick={() => {
            dispatch({ type: "step", page: pageKey, lab: labKey, step: stepKey, done: !done });
            if (!done) setOpen(false);
          }}
        >
          {done && <Icon name="check" />}
        </button>
        <button
          type="button"
          className="step-title"
          aria-expanded={isOpen}
          aria-controls={`${anchor}-body`}
          onClick={() => setOpen(!isOpen)}
        >
          <span>Step {label} · </span>
          {title}
        </button>
        <span className="chev" aria-hidden="true">
          <Icon name="chev" />
        </span>
      </div>
      <div className="step-body prose" id={`${anchor}-body`} hidden={!isOpen}>
        {children}
      </div>
    </div>
  );
}

export function CommitConfirm({ labKey }: { labKey: string }) {
  const { pageKey, committed } = useLab(labKey);
  const { dispatch } = useLearner();
  return (
    <div className={`commit${committed ? " yes" : ""}`}>
      <div>
        {committed ? (
          <>
            <strong>Committed.</strong> This lab is in your portfolio repository.
          </>
        ) : (
          "Finished the lab and pushed your work? Confirm it to complete this lab."
        )}
      </div>
      <button
        type="button"
        className={`btn${committed ? "" : " primary"}`}
        onClick={() => dispatch({ type: "commit", page: pageKey, lab: labKey, done: !committed })}
      >
        {committed ? "Undo" : "I committed it"}
      </button>
    </div>
  );
}
