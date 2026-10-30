import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { CSSProperties } from "react";
import { DrillPanel } from "@/components/chapter/decide";
import {
  LearnCard,
  LearnHeader,
  LearnPager,
  RevealAllTerms,
  TermCard,
} from "@/components/chapter/learn";
import { CommitConfirm, LabRing, LabStep } from "@/components/chapter/practise";
import { Flashcards } from "@/components/chapter/review";
import { ChapterPercent, ChapterShell, ModePanel, SaveStatus } from "@/components/chapter/shell";
import { CopyButtons } from "@/components/copy-buttons";
import { TermPopover, type TermDef } from "@/components/term-popover";
import { Icon } from "@/components/icons";
import type { Block, Section } from "@/content/types";
import {
  findPageBySlug,
  getGlossary,
  getManifest,
  listCourses,
  loadPage,
  neighbours,
  pageHref,
  publishedPages,
} from "@/lib/content";
import { partHue } from "@/lib/hues";
import { isLearnSection, specOf } from "@/lib/learner-state";
import type { Mode } from "@/lib/ops-schema";
import { formatLab } from "@/lib/route-data";

export const dynamicParams = false;

type Params = { course: string; page: string };

export function generateStaticParams(): Params[] {
  return listCourses().flatMap((c) => {
    const m = getManifest(c.slug);
    return m ? publishedPages(m).map((p) => ({ course: c.slug, page: p.slug })) : [];
  });
}

const stripTags = (html: string) => html.replace(/<[^>]+>/g, "");
/** The book writes the definition after "Definition:" in lower case; present it as a sentence. */
const lede = (html: string) =>
  html
    .replace(/^<strong>Definition:?<\/strong>\s*/i, "")
    .replace(
      /^(\s*(?:<[^>]+>\s*)*)([a-z])/,
      (_m, tags: string, ch: string) => tags + ch.toUpperCase(),
    );
const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { course, page } = await params;
  const manifest = getManifest(course);
  const meta = manifest && findPageBySlug(manifest, page);
  if (!meta) return {};
  const full = loadPage(course, meta.key);
  return {
    title: meta.label ? `${meta.label}: ${meta.title}` : meta.title,
    description: full.definitionHtml ? stripTags(lede(full.definitionHtml)) : undefined,
  };
}

function Html({ html, className = "prose" }: { html: string; className?: string }) {
  return <div className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}

const htmlOf = (blocks: Block[]) => blocks.map((b) => ("html" in b ? b.html : "")).join("");

function LabView({ lab }: { lab: Section }) {
  const intro = lab.blocks.find((b) => b.kind === "html");
  return (
    <>
      <div className="mode-head">
        <Icon name="practise" />
        <h2>{capitalise(lab.title.replace(/^Practice lab(, part \d+)?:\s*/i, ""))}</h2>
        <SaveStatus />
      </div>
      <div className="card">
        <div className="lab-top">
          <LabRing labKey={lab.key} />
          {intro && <Html html={intro.html} className="prose small" />}
        </div>
      </div>
      <div className="steps">
        {lab.blocks.map((b, i) => {
          if (b === intro) return null;
          switch (b.kind) {
            case "lab-step":
              return (
                <LabStep
                  key={i}
                  labKey={lab.key}
                  stepKey={b.key}
                  label={b.label}
                  title={b.title}
                  anchor={b.anchor}
                >
                  <div dangerouslySetInnerHTML={{ __html: b.html }} />
                </LabStep>
              );
            case "lab-troubleshoot":
              return (
                <details key={i} className="fold">
                  <summary>
                    <Icon name="flag" /> {b.title}: known problems and fixes
                  </summary>
                  <Html html={b.html} />
                </details>
              );
            case "lab-commit":
              return (
                <div key={i} className="commit">
                  <strong>Commit it</strong>
                  <Html html={b.html} />
                </div>
              );
            case "html": {
              const heading = b.html.match(/<h3[^>]*>(.*?)<\/h3>/);
              return (
                <details key={i} className="fold">
                  <summary>{heading ? stripTags(heading[1]!) : "More"}</summary>
                  <Html html={b.html.replace(/<h3[^>]*>.*?<\/h3>/, "")} />
                </details>
              );
            }
            default:
              return null;
          }
        })}
      </div>
      <CommitConfirm labKey={lab.key} />
    </>
  );
}

export default async function ChapterPage({ params }: { params: Promise<Params> }) {
  const { course, page: slug } = await params;
  const manifest = getManifest(course);
  const meta = manifest && findPageBySlug(manifest, slug);
  if (!manifest || !meta) notFound();
  const page = loadPage(course, meta.key);
  const part = manifest.parts.find((p) => p.number === page.partNumber);
  const { prev, next } = neighbours(manifest, page.key);
  const spec = specOf(meta);

  const learn = page.content.filter((s) => isLearnSection(s.type));
  const labs = page.content.filter((s) => s.type === "lab");
  const stuck = page.content.filter((s) => s.type === "stuck");
  const drill = page.content.find((s) => s.type === "drill");
  const interview = page.content.filter((s) => s.type === "interview");
  const modes: Mode[] = [];
  if (learn.length) modes.push("learn");
  if (labs.length || stuck.length) modes.push("practise");
  if (drill) modes.push("decide");
  if (interview.length) modes.push("review");

  const anchors: Record<string, Mode> = {};
  for (const s of [...labs, ...stuck]) anchors[s.key] = "practise";
  for (const s of labs)
    for (const b of s.blocks) if (b.kind === "lab-step") anchors[b.anchor] = "practise";
  if (drill) anchors[drill.key] = "decide";
  for (const s of interview) anchors[s.key] = "review";

  const terms = getGlossary(course).flatMap((g) =>
    g.definitions
      .filter((d) => d.pageKey === page.key)
      .map((d) => ({ term: g.term, html: d.html })),
  );
  const termDefs: TermDef[] = getGlossary(course).flatMap((g) => {
    const own = g.definitions.find((d) => d.pageKey === page.key);
    return own ? [{ id: g.term.toLowerCase(), term: g.term, slug: g.slug, html: own.html }] : [];
  });
  const cards = interview.flatMap((s) =>
    s.blocks
      .filter((b): b is Extract<Block, { kind: "card" }> => b.kind === "card")
      .map((b) => ({ key: b.key, text: b.text })),
  );
  const labSteps = labs.reduce(
    (n, s) => n + s.blocks.filter((b) => b.kind === "lab-step").length,
    0,
  );
  const hue = partHue(page.partNumber);

  return (
    <main id="main">
      <header className="ch-hero" style={{ "--h": hue } as CSSProperties}>
        <div className="wrap">
          <Link className="back" href={`/learn/${course}`}>
            <Icon name="back" /> Your route
          </Link>
          <div className="eyebrow">
            {part && part.number ? `Part ${part.number} · ${part.title}` : "Start here"}
          </div>
          <h1>
            {page.label && <span className="sr-only">{page.label}: </span>}
            {page.title}
          </h1>
          {page.definitionHtml && (
            <p className="def" dangerouslySetInnerHTML={{ __html: lede(page.definitionHtml) }} />
          )}
          <div className="chips">
            <span className="chip">
              <Icon name="clock" /> {page.readingMinutes} min read
            </span>
            {labSteps > 0 && (
              <span className="chip">
                <Icon name="practise" /> {labSteps}-step lab · {formatLab(page.labMinutes)}
              </span>
            )}
            {terms.length > 0 && (
              <span className="chip">
                <Icon name="tag" /> {terms.length} key terms
              </span>
            )}
            {cards.length > 0 && (
              <span className="chip">
                <Icon name="review" /> {cards.length} questions
              </span>
            )}
          </div>
        </div>
      </header>

      <ChapterShell
        sections={[
          ...learn.map((x) => ({
            key: x.key,
            title: x.type === "jargon" ? "Key terms" : x.title,
            mode: "learn" as Mode,
          })),
          ...labs.map((x) => ({ key: x.key, title: x.title, mode: "practise" as Mode })),
          ...stuck.map((x) => ({ key: x.key, title: x.title, mode: "practise" as Mode })),
          ...(drill ? [{ key: drill.key, title: drill.title, mode: "decide" as Mode }] : []),
          ...interview.map((x) => ({ key: x.key, title: x.title, mode: "review" as Mode })),
        ]}
        pageKey={page.key}
        spec={spec}
        modes={modes}
        learnKeys={learn.map((s) => s.key)}
        anchors={anchors}
      >
        <div className="wrap" style={{ paddingTop: modes.length > 1 ? 0 : 12 }}>
          <div
            style={
              {
                "--h": hue,
                "--c": `hsl(${hue} var(--ps) var(--pl))`,
                paddingTop: 12,
              } as CSSProperties
            }
          >
            <ChapterPercent />
          </div>
        </div>

        {learn.length > 0 && (
          <ModePanel mode="learn">
            <LearnHeader titles={learn.map((s) => (s.type === "jargon" ? "Key terms" : s.title))} />
            {learn.map((s, i) => (
              <LearnCard
                key={s.key}
                index={i}
                sectionKey={s.key}
                kicker={`${s.type === "jargon" ? "Key terms" : `Section ${i + 1} of ${learn.length}`}`}
                title={s.type === "jargon" ? "Jargon decoder" : s.title}
              >
                {s.type === "jargon" && terms.length ? (
                  <>
                    <p className="muted small">
                      Tap a term to see what it means. Every term here is used in this chapter.
                    </p>
                    <div className="terms">
                      {terms.map((t) => (
                        <TermCard key={t.term} term={t.term}>
                          <span dangerouslySetInnerHTML={{ __html: t.html }} />
                        </TermCard>
                      ))}
                    </div>
                    <RevealAllTerms />
                  </>
                ) : (
                  <Html html={htmlOf(s.blocks)} />
                )}
              </LearnCard>
            ))}
            <LearnPager hasPractise={modes.includes("practise")} />
          </ModePanel>
        )}

        {(labs.length > 0 || stuck.length > 0) && (
          <ModePanel mode="practise">
            {labs.map((lab) => (
              <section key={lab.key} id={lab.key} style={{ display: "grid", gap: 18 }}>
                <LabView lab={lab} />
              </section>
            ))}
            {stuck.map((s) => (
              <section key={s.key} id={s.key} style={{ display: "grid", gap: 12 }}>
                <div className="mode-head" style={{ marginTop: 8 }}>
                  <Icon name="review" />
                  <h2>{s.title}</h2>
                </div>
                {s.blocks.map((b, i) =>
                  b.kind === "prompt" ? (
                    <div key={i} className="prompt">
                      <Html html={b.html} />
                      <button type="button" className="code-copy" data-copy-text={b.text}>
                        Copy prompt
                      </button>
                    </div>
                  ) : "html" in b ? (
                    <Html key={i} html={b.html} />
                  ) : null,
                )}
              </section>
            ))}
          </ModePanel>
        )}

        {drill && (
          <ModePanel mode="decide">
            <section id={drill.key} style={{ display: "grid", gap: 18 }}>
              <div className="mode-head">
                <Icon name="decide" />
                <h2>{drill.title.replace(/^Decision drill:\s*/i, "")}</h2>
                <SaveStatus />
              </div>
              <article className="card">
                <div className="card-kicker">The client&apos;s situation</div>
                <Html
                  html={htmlOf(drill.blocks.filter((b) => b.kind === "html"))}
                  className="prose"
                />
              </article>
              <DrillPanel
                reveal={
                  <div
                    dangerouslySetInnerHTML={{
                      __html: htmlOf(drill.blocks.filter((b) => b.kind === "drill-reveal")).replace(
                        /<p><strong>How an experienced engineer reasons[^<]*<\/strong><\/p>/,
                        "",
                      ),
                    }}
                  />
                }
              />
            </section>
          </ModePanel>
        )}

        {interview.length > 0 && (
          <ModePanel mode="review">
            <section id={interview[0]!.key} style={{ display: "grid", gap: 18 }}>
              <div className="mode-head">
                <Icon name="review" />
                <h2>Interview practice</h2>
                <SaveStatus />
              </div>
              <Flashcards cards={cards} />
            </section>
          </ModePanel>
        )}
      </ChapterShell>

      {(prev || next) && (
        <nav
          className="wrap chapter-nav"
          aria-label="Previous and next chapter"
          style={{ paddingBottom: 48 }}
        >
          {prev && (
            <Link
              className="next-ch"
              rel="prev"
              href={pageHref(course, prev)}
              style={{ "--h": partHue(prev.partNumber) } as CSSProperties}
            >
              <span>
                <Icon name="back" />
              </span>
              <div>
                <div className="k">Previous{prev.label ? ` · ${prev.label}` : ""}</div>
                <div className="t">{prev.title}</div>
              </div>
            </Link>
          )}
          {next && (
            <Link
              className="next-ch"
              rel="next"
              href={pageHref(course, next)}
              style={{ "--h": partHue(next.partNumber) } as CSSProperties}
            >
              <div>
                <div className="k">Up next{next.label ? ` · ${next.label}` : ""}</div>
                <div className="t">{next.title}</div>
              </div>
              <span style={{ marginLeft: "auto" }}>
                <Icon name="arrow" />
              </span>
            </Link>
          )}
        </nav>
      )}
      <CopyButtons />
      <TermPopover course={course} terms={termDefs} />
    </main>
  );
}
