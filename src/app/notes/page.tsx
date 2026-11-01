import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/icons";
import { NotesView, type NotesPage } from "@/components/notes-view";
import { defaultBranding } from "@/lib/branding";
import { getManifest, pageHref, publishedPages } from "@/lib/content";

export const metadata: Metadata = { title: "Notes and bookmarks" };

export default function NotesRoute() {
  const course = defaultBranding.defaultCourse;
  const manifest = getManifest(course)!;
  const pages: NotesPage[] = publishedPages(manifest).map((p) => ({
    key: p.key,
    label: p.label,
    title: p.title,
    href: pageHref(course, p),
    sections: Object.fromEntries(
      p.sections.map((s) => [s.key, s.type === "jargon" ? "Key terms" : s.title]),
    ),
  }));
  return (
    <main id="main">
      <div className="wrap panel-wrap">
        <Link className="back" href={`/learn/${course}`}>
          <Icon name="back" /> Your route
        </Link>
        <h1 style={{ margin: 0, fontSize: "2rem" }}>Notes and bookmarks</h1>
        <NotesView pages={pages} />
      </div>
    </main>
  );
}
