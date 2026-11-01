"use client";

// Filters the server-rendered glossary in place: hides entries and empty letter groups.
import { useState } from "react";

export function GlossaryFilter({ total }: { total: number }) {
  const [q, setQ] = useState("");
  const [shown, setShown] = useState(total);

  const filter = (value: string) => {
    setQ(value);
    const needle = value.trim().toLowerCase();
    let count = 0;
    for (const group of document.querySelectorAll<HTMLElement>(".glossary-group")) {
      let any = false;
      for (const entry of group.querySelectorAll<HTMLElement>(".glossary-entry")) {
        const match = !needle || (entry.dataset.search ?? "").includes(needle);
        entry.hidden = !match;
        if (match) count++;
        any ||= match;
      }
      group.hidden = !any;
    }
    setShown(count);
  };

  return (
    <div style={{ display: "grid", gap: 6 }}>
      <label htmlFor="glossary-q">
        <strong>Filter terms</strong>
      </label>
      <input
        id="glossary-q"
        className="field"
        type="search"
        autoComplete="off"
        placeholder="e.g. token, embedding, idempotent"
        value={q}
        onChange={(e) => filter(e.target.value)}
      />
      <p className="muted small" role="status" aria-live="polite" style={{ margin: 0 }}>
        {shown === total ? `${total} terms` : `${shown} of ${total} terms`}
      </p>
    </div>
  );
}
