"use client";

// Everything the learner bookmarked or wrote, grouped by chapter in course order.
import Link from "next/link";
import { useLearner } from "./learner/provider";

export interface NotesPage {
  key: string;
  label: string;
  title: string;
  href: string;
  sections: Record<string, string>; // section key → title
}

export function NotesView({ pages }: { pages: NotesPage[] }) {
  const { state, status } = useLearner();
  if (status === "loading") return <p className="muted">Loading your notes…</p>;

  const groups = pages
    .map((p) => ({
      page: p,
      marks: (state.bookmarks[p.key] ?? []).filter((k) => p.sections[k]),
      notes: state.notes.filter((n) => n.page === p.key),
    }))
    .filter((g) => g.marks.length || g.notes.length);

  if (!groups.length)
    return (
      <p className="muted">
        Nothing yet. Use <strong>Bookmark</strong> or <strong>Add note</strong> under any section
        and it will appear here.
      </p>
    );

  return (
    <div style={{ display: "grid", gap: 18 }}>
      {groups.map(({ page, marks, notes }) => (
        <section key={page.key} className="card" aria-labelledby={`n-${page.key}`}>
          <h2 id={`n-${page.key}`} style={{ margin: 0, fontSize: "1.25rem" }}>
            <Link href={page.href}>{page.label ? `${page.label}: ${page.title}` : page.title}</Link>
          </h2>
          {marks.length > 0 && (
            <>
              <h3 className="small muted" style={{ margin: "12px 0 4px" }}>
                Bookmarks
              </h3>
              <ul className="note-links">
                {marks.map((k) => (
                  <li key={k}>
                    <Link href={`${page.href}#${k}`}>{page.sections[k]}</Link>
                  </li>
                ))}
              </ul>
            </>
          )}
          {notes.length > 0 && (
            <>
              <h3 className="small muted" style={{ margin: "12px 0 4px" }}>
                Notes
              </h3>
              <ul className="notes">
                {notes.map((n) => (
                  <li key={n.id} className="note">
                    <Link className="small" href={`${page.href}#${n.section}`}>
                      {page.sections[n.section] ?? "Section"}
                    </Link>
                    <p className="note-body">{n.body}</p>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      ))}
    </div>
  );
}
