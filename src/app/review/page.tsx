import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/icons";
import { ReviewQueue, type ReviewCard } from "@/components/review-queue";
import { defaultBranding } from "@/lib/branding";
import { getCards, getManifest, pageHref } from "@/lib/content";

export const metadata: Metadata = { title: "Review due" };

export default function ReviewPage() {
  const course = defaultBranding.defaultCourse;
  const manifest = getManifest(course)!;
  const pages = new Map(manifest.pages.map((p) => [p.key, p]));
  const cards: ReviewCard[] = getCards(course).map((c) => ({
    key: c.key,
    text: c.text,
    number: pages.get(c.pageKey)?.number,
    href: `${pageHref(course, pages.get(c.pageKey)!)}#interview`,
  }));
  return (
    <main id="main">
      <div className="wrap panel-wrap m-review">
        <Link className="back" href={`/learn/${course}`}>
          <Icon name="back" /> Your route
        </Link>
        <h1 style={{ margin: 0, fontSize: "2rem" }}>Review due</h1>
        <ReviewQueue cards={cards} routeHref={`/learn/${course}`} />
      </div>
    </main>
  );
}
