import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CopyButtons } from "@/components/copy-buttons";
import { SectionView } from "@/components/section-blocks";
import { Toc } from "@/components/toc";
import {
  findPageBySlug,
  getManifest,
  listCourses,
  loadPage,
  neighbours,
  pageHref,
  publishedPages,
} from "@/lib/content";

export const dynamicParams = false;

type Params = { course: string; page: string };

export function generateStaticParams(): Params[] {
  return listCourses().flatMap((c) => {
    const m = getManifest(c.slug);
    return m ? publishedPages(m).map((p) => ({ course: c.slug, page: p.slug })) : [];
  });
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, "").replace(/^Definition:\s*/i, "");
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { course, page } = await params;
  const manifest = getManifest(course);
  const meta = manifest && findPageBySlug(manifest, page);
  if (!meta) return {};
  const full = loadPage(course, meta.key);
  return {
    title: meta.label ? `${meta.label}: ${meta.title}` : meta.title,
    description: full.definitionHtml ? stripTags(full.definitionHtml) : undefined,
  };
}

export default async function ReaderPage({ params }: { params: Promise<Params> }) {
  const { course, page: slug } = await params;
  const manifest = getManifest(course);
  const meta = manifest && findPageBySlug(manifest, slug);
  if (!manifest || !meta) notFound();
  const page = loadPage(course, meta.key);
  const { prev, next } = neighbours(manifest, page.key);
  const part = manifest.parts.find((p) => p.number === page.partNumber);
  const toc = page.content
    .filter((s) => s.key !== "intro")
    .map((s) => ({ key: s.key, title: s.title }));
  const partPages = (part?.pages ?? [])
    .map((k) => manifest.pages.find((p) => p.key === k)!)
    .filter(Boolean);

  return (
    <div className="mx-auto max-w-7xl px-4 lg:grid lg:grid-cols-[14rem_minmax(0,1fr)_15rem] lg:gap-10">
      <nav aria-label="Chapters in this part" className="hidden lg:block">
        <div className="sticky top-[calc(var(--header-h)+1.5rem)] mt-8 max-h-[calc(100vh-6rem)] overflow-y-auto text-sm">
          <Link href={`/learn/${course}`} className="block py-1">
            ← Course home
          </Link>
          <p className="mt-4 font-bold">
            {part && part.number > 0 ? `Part ${part.number} — ${part.title}` : part?.title}
          </p>
          <ol className="mt-2 space-y-1">
            {partPages.map((p) => (
              <li key={p.key}>
                {p.status === "published" ? (
                  <Link
                    href={pageHref(course, p)}
                    aria-current={p.key === page.key ? "page" : undefined}
                    className={`block rounded px-2 py-1.5 no-underline ${p.key === page.key ? "bg-surface font-bold text-text" : "text-muted hover:text-text"}`}
                  >
                    {p.number !== undefined ? `${p.number}. ` : ""}
                    {p.title}
                  </Link>
                ) : (
                  <span className="block px-2 py-1.5 text-muted">
                    {p.number !== undefined ? `${p.number}. ` : ""}
                    {p.title} <span className="text-xs">(coming soon)</span>
                  </span>
                )}
              </li>
            ))}
          </ol>
        </div>
      </nav>

      <main id="main" className="min-w-0 py-8">
        <article>
          <header>
            {(page.label || part) && (
              <p className="text-sm text-muted">
                {part && part.number > 0 ? `Part ${part.number}` : part?.title}
                {page.label ? ` · ${page.label}` : ""}
              </p>
            )}
            <h1 className="mt-1 text-3xl font-bold leading-tight md:text-4xl">{page.title}</h1>
            <p className="mt-2 text-sm text-muted">
              {page.readingMinutes} min read
              {page.labMinutes ? ` · lab about ${page.labMinutes} min` : ""}
            </p>
            {page.definitionHtml && (
              <div
                className="prose mt-6 rounded-lg border-l-4 border-accent bg-surface p-4 text-lg"
                dangerouslySetInnerHTML={{ __html: page.definitionHtml }}
              />
            )}
          </header>

          {toc.length > 0 && (
            <details className="mt-6 rounded-lg border border-hairline px-4 lg:hidden">
              <summary className="flex min-h-11 cursor-pointer items-center font-bold">
                On this page
              </summary>
              <div className="pb-3">
                <Toc items={toc} />
              </div>
            </details>
          )}

          {page.content.map((s) => (
            <SectionView key={s.key} section={s} />
          ))}
        </article>

        <nav
          aria-label="Previous and next"
          className="mt-16 grid gap-3 border-t border-hairline pt-6 sm:grid-cols-2"
        >
          {prev ? (
            <Link
              href={pageHref(course, prev)}
              rel="prev"
              className="rounded-lg border border-hairline p-4 no-underline hover:border-border"
            >
              <span className="block text-sm text-muted">← Previous</span>
              <span className="font-medium">{prev.title}</span>
            </Link>
          ) : (
            <span />
          )}
          {next && (
            <Link
              href={pageHref(course, next)}
              rel="next"
              className="rounded-lg border border-hairline p-4 text-right no-underline hover:border-border"
            >
              <span className="block text-sm text-muted">Next →</span>
              <span className="font-medium">{next.title}</span>
            </Link>
          )}
        </nav>
      </main>

      <aside aria-label="On this page" className="hidden lg:block">
        <div className="sticky top-[calc(var(--header-h)+1.5rem)] mt-8 max-h-[calc(100vh-6rem)] overflow-y-auto">
          <p className="mb-2 text-sm font-bold">On this page</p>
          <Toc items={toc} />
        </div>
      </aside>
      <CopyButtons />
    </div>
  );
}
