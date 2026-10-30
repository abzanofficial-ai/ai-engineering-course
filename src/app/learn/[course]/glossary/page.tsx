import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { GlossaryFilter } from "@/components/glossary-filter";
import { Icon } from "@/components/icons";
import { getGlossary, getManifest, listCourses, pageHref } from "@/lib/content";

export const dynamicParams = false;

type Params = { course: string };

export function generateStaticParams(): Params[] {
  return listCourses().map((c) => ({ course: c.slug }));
}

export const metadata: Metadata = { title: "Glossary" };

const letterOf = (term: string) => {
  const ch = term.charAt(0).toUpperCase();
  return /[A-Z]/.test(ch) ? ch : "#";
};

export default async function GlossaryPage({ params }: { params: Promise<Params> }) {
  const { course } = await params;
  const manifest = getManifest(course);
  if (!manifest) notFound();
  const pages = new Map(manifest.pages.map((p) => [p.key, p]));
  const groups = new Map<string, ReturnType<typeof getGlossary>>();
  for (const g of getGlossary(course)) {
    const l = letterOf(g.term);
    groups.set(l, [...(groups.get(l) ?? []), g]);
  }
  const letters = [...groups.keys()].sort((a, b) =>
    a === "#" ? -1 : b === "#" ? 1 : a.localeCompare(b),
  );

  return (
    <main id="main" className="wrap panel-wrap">
      <Link className="back" href={`/learn/${course}`}>
        <Icon name="back" /> Your route
      </Link>
      <h1 style={{ margin: 0, fontSize: "2rem" }}>Glossary</h1>
      <p className="muted" style={{ margin: 0 }}>
        Every term from the chapters&apos; jargon decoders, with the chapter that defines it.
      </p>
      <GlossaryFilter total={getGlossary(course).length} />
      <nav aria-label="Jump to letter">
        <ul className="glossary-letters">
          {letters.map((l) => (
            <li key={l}>
              <a href={`#letter-${l === "#" ? "symbols" : l}`}>{l}</a>
            </li>
          ))}
        </ul>
      </nav>
      {letters.map((l) => (
        <section
          key={l}
          className="glossary-group"
          aria-labelledby={`letter-${l === "#" ? "symbols" : l}`}
        >
          <h2 id={`letter-${l === "#" ? "symbols" : l}`}>{l === "#" ? "Symbols" : l}</h2>
          <div className="glossary-list">
            {groups.get(l)!.map((g) => (
              <dl
                key={g.slug}
                id={g.slug}
                className="glossary-entry"
                data-search={`${g.term} ${g.definitions.map((d) => d.text).join(" ")}`.toLowerCase()}
              >
                <dt>{g.term}</dt>
                {g.definitions.map((d) => {
                  const p = pages.get(d.pageKey);
                  return (
                    <dd key={d.pageKey}>
                      <span dangerouslySetInnerHTML={{ __html: d.html }} />
                      {p && (
                        <>
                          {" "}
                          <Link className="from" href={pageHref(course, p)}>
                            {p.label ? `${p.label}: ${p.title}` : p.title}
                          </Link>
                        </>
                      )}
                    </dd>
                  );
                })}
              </dl>
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}
