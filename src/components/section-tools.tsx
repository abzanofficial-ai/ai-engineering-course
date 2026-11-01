"use client";

// Bookmark and notes for one section (ADR-0027). Notes are the learner's own text: rendered
// as plain text only, kept on this device's outbox until synced, and part of their export.
import { useState } from "react";
import { Icon } from "./icons";
import { useLearner } from "./learner/provider";
import { NOTE_MAX } from "@/lib/ops-schema";

export function SectionTools({
  pageKey,
  sectionKey,
  title,
}: {
  pageKey: string;
  sectionKey: string;
  title: string;
}) {
  const { state, dispatch } = useLearner();
  const [draft, setDraft] = useState<{ id: string | null; body: string } | null>(null);
  const marked = (state.bookmarks[pageKey] ?? []).includes(sectionKey);
  const notes = state.notes.filter((n) => n.page === pageKey && n.section === sectionKey);

  const submit = () => {
    if (!draft || !draft.body.trim()) return;
    dispatch({
      type: "note_save",
      id: draft.id ?? crypto.randomUUID(),
      page: pageKey,
      section: sectionKey,
      body: draft.body.trim(),
    });
    setDraft(null);
  };

  return (
    <div className="section-tools">
      <div className="section-tools-row">
        <button
          type="button"
          className="btn small"
          aria-pressed={marked}
          aria-label={`Bookmark: ${title}`}
          onClick={() =>
            dispatch({ type: "bookmark", page: pageKey, section: sectionKey, on: !marked })
          }
        >
          <Icon name="bookmark" /> Bookmark
        </button>
        {!draft && (
          <button
            type="button"
            className="btn small"
            aria-label={`Add note: ${title}`}
            onClick={() => setDraft({ id: null, body: "" })}
          >
            <Icon name="note" /> Add note
          </button>
        )}
      </div>

      {notes.length > 0 && (
        <ul className="notes" aria-label={`Your notes on: ${title}`}>
          {notes.map((n) =>
            draft?.id === n.id ? null : (
              <li key={n.id} className="note">
                <p className="note-body">{n.body}</p>
                <div className="note-actions">
                  <button
                    type="button"
                    className="btn small"
                    onClick={() => setDraft({ id: n.id, body: n.body })}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="btn small danger"
                    onClick={() => {
                      if (window.confirm("Delete this note? This can't be undone."))
                        dispatch({ type: "note_delete", id: n.id });
                    }}
                  >
                    Delete
                  </button>
                </div>
              </li>
            ),
          )}
        </ul>
      )}

      {draft && (
        <form
          className="note-form"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <label htmlFor={`note-${sectionKey}`} className="small">
            <strong>{draft.id ? "Edit your note" : "Your note"}</strong> (only you can see it)
          </label>
          <textarea
            id={`note-${sectionKey}`}
            className="field"
            rows={4}
            maxLength={NOTE_MAX}
            autoFocus
            value={draft.body}
            onChange={(e) => setDraft({ ...draft, body: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === "Escape") setDraft(null);
            }}
          />
          <div className="note-actions">
            <button type="submit" className="btn small primary" disabled={!draft.body.trim()}>
              Save note
            </button>
            <button type="button" className="btn small" onClick={() => setDraft(null)}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
