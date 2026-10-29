import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getManifest, listCourses, pageHref } from "@/lib/content";
import type { PageMeta } from "@/content/types";

export const dynamicParams = false;

export function generateStaticParams() {
  return listCourses().map((c) => ({ course: c.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ course: string }>;
}): Promise<Metadata> {
  const { course } = await params;
  return { title: getManifest(course)?.title ?? "Course" };
}

function Duration({ page }: { page: PageMeta }) {
  const bits = [`${page.readingMinutes} min read`];
  if (page.labMinutes)
    bits.push(
      `lab ~${page.labMinutes >= 90 ? `${Math.round(page.labMinutes / 30) / 2} h` : `${page.labMinutes} min`}`,
    );
  return <span className="text-sm text-muted">{bits.join(" · ")}</span>;
}

export default async function CourseHome({ params }: { params: Promise<{ course: string }> }) {
  const { course } = await params;
  const manifest = getManifest(course);
  if (!manifest) notFound();
  const byKey = new Map(manifest.pages.map((p) => [p.key, p]));
  const published = manifest.pages.filter(
    (p) => p.status === "published" && p.kind === "chapter",
  ).length;
  const total = manifest.pages.filter((p) => p.kind === "chapter").length;

  return (
    <main id="main" className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-3xl font-bold leading-tight">{manifest.title}</h1>
      <p className="mt-2 text-muted">
        {published} of {total} chapters available. New chapters are added as they are written.
      </p>

      {manifest.parts.map((part) => {
        const pages = part.pages.map((k) => byKey.get(k)!).filter(Boolean);
        const soon = pages.every((p) => p.status === "coming-soon");
        return (
          <section key={part.key} aria-labelledby={`${part.key}-h`} className="mt-10">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h2 id={`${part.key}-h`} className="text-xl font-bold">
                {part.number > 0 ? `Part ${part.number} — ${part.title}` : part.title}
              </h2>
              {soon && (
                <span className="rounded-full border border-border px-2 text-xs text-muted">
                  Coming soon
                </span>
              )}
            </div>
            {part.introHtml && (
              <details className="mt-2 text-muted">
                <summary className="flex min-h-11 cursor-pointer items-center text-accent">
                  About this part
                </summary>
                <div
                  className="prose mt-2 text-text"
                  dangerouslySetInnerHTML={{ __html: part.introHtml }}
                />
              </details>
            )}
            <ol className="mt-3 divide-y divide-hairline rounded-lg border border-hairline">
              {pages.map((p) => (
                <li
                  key={p.key}
                  className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-3"
                >
                  {p.status === "published" ? (
                    <Link href={pageHref(course, p)} className="font-medium">
                      {p.label && (
                        <span className="text-muted">{p.label.replace("Chapter ", "")} · </span>
                      )}
                      {p.title}
                    </Link>
                  ) : (
                    <span className="text-muted">
                      {p.label && <span>{p.label.replace("Chapter ", "")} · </span>}
                      {p.title}
                      <span className="ml-2 rounded-full border border-border px-2 text-xs">
                        Coming soon
                      </span>
                    </span>
                  )}
                  {p.status === "published" && <Duration page={p} />}
                </li>
              ))}
            </ol>
          </section>
        );
      })}
    </main>
  );
}
