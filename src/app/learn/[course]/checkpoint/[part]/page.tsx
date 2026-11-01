import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { CSSProperties } from "react";
import {
  CheckpointFlow,
  type CheckpointCard,
  type CheckpointDrill,
} from "@/components/checkpoint-flow";
import { Icon } from "@/components/icons";
import { partContent } from "@/lib/checkpoint";
import { getCards, getManifest, listCourses, loadPage, pageHref } from "@/lib/content";
import { partHue } from "@/lib/hues";

export const dynamicParams = false;
type Params = { course: string; part: string };

export function generateStaticParams(): Params[] {
  return listCourses().flatMap((c) => {
    const m = getManifest(c.slug);
    return (m?.parts ?? [])
      .filter((p) => p.number > 0 && partContent(m!, p.number).cards.length > 0)
      .map((p) => ({ course: c.slug, part: String(p.number) }));
  });
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { course, part } = await params;
  const p = getManifest(course)?.parts.find((x) => x.number === Number(part));
  return { title: p ? `Part ${p.number} checkpoint: ${p.title}` : "Checkpoint" };
}

export default async function CheckpointPage({ params }: { params: Promise<Params> }) {
  const { course, part: partParam } = await params;
  const manifest = getManifest(course);
  const number = Number(partParam);
  const part = manifest?.parts.find((p) => p.number === number);
  if (!manifest || !part) notFound();
  const content = partContent(manifest, number);
  const pages = new Map(manifest.pages.map((p) => [p.key, p]));
  const cards: CheckpointCard[] = getCards(course)
    .filter((c) => content.cards.includes(c.key))
    .map((c) => ({
      key: c.key,
      text: c.text,
      number: pages.get(c.pageKey)?.number,
      href: `${pageHref(course, pages.get(c.pageKey)!)}#interview`,
    }));
  const drills: CheckpointDrill[] = content.drillPages.map((key) => {
    const page = loadPage(course, key);
    const drill = page.content.find((s) => s.type === "drill")!;
    return {
      pageKey: key,
      number: page.number,
      title: drill.title.replace(/^Decision drill:\s*/i, ""),
      scenarioHtml: drill.blocks.map((b) => (b.kind === "html" ? b.html : "")).join(""),
    };
  });
  const routeHref = `/learn/${course}`;

  return (
    <main id="main">
      <header className="ch-hero" style={{ "--h": partHue(number) } as CSSProperties}>
        <div className="wrap">
          <Link className="back" href={routeHref}>
            <Icon name="back" /> Your route
          </Link>
          <div className="eyebrow">Part {number} · checkpoint</div>
          <h1>{part.title}</h1>
        </div>
      </header>
      <div className="wrap panel-wrap m-review">
        <CheckpointFlow
          course={course}
          part={number}
          partTitle={part.title}
          routeHref={routeHref}
          cards={cards}
          drills={drills}
        />
      </div>
    </main>
  );
}
