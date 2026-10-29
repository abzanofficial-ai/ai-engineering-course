import type { CourseManifest, PageMeta } from "./types";

export interface PageChange {
  key: string;
  title: string;
  changedSections: string[];
  addedSections: string[];
  removedSections: string[];
  addedSteps: string[];
  removedSteps: string[];
  addedCards: number;
  removedCards: number;
}

export interface ContentDiff {
  identical: boolean;
  addedPages: { key: string; title: string }[];
  removedPages: { key: string; title: string }[];
  nowPublished: { key: string; title: string }[];
  nowComingSoon: { key: string; title: string }[];
  renamedSlugs: { key: string; from: string; to: string }[];
  changedPages: PageChange[];
  /** Keys that learner data may reference and that no longer exist. */
  removedKeys: { pageKey: string; kind: "page" | "section" | "step" | "card"; key: string }[];
  warnings: string[];
}

const ref = (p: PageMeta) => ({ key: p.key, title: p.title });

function stepsOf(p: PageMeta): Set<string> {
  return new Set(p.sections.flatMap((s) => (s.steps ?? []).map((st) => `${s.key}/${st.key}`)));
}

export function diffManifests(before: CourseManifest | null, after: CourseManifest): ContentDiff {
  const old = new Map((before?.pages ?? []).map((p) => [p.key, p]));
  const neu = new Map(after.pages.map((p) => [p.key, p]));
  const diff: ContentDiff = {
    identical: before?.sourceHash === after.sourceHash,
    addedPages: [],
    removedPages: [],
    nowPublished: [],
    nowComingSoon: [],
    renamedSlugs: [],
    changedPages: [],
    removedKeys: [],
    warnings: after.warnings,
  };

  for (const [key, p] of neu) {
    const o = old.get(key);
    if (!o) {
      diff.addedPages.push(ref(p));
      continue;
    }
    if (o.status === "coming-soon" && p.status === "published") diff.nowPublished.push(ref(p));
    if (o.status === "published" && p.status === "coming-soon") diff.nowComingSoon.push(ref(p));
    if (o.slug !== p.slug && p.status === "published" && o.status === "published")
      diff.renamedSlugs.push({ key, from: o.slug, to: p.slug });
    if (o.status !== "published" || p.status !== "published" || o.hash === p.hash) continue;

    const os = new Map(o.sections.map((s) => [s.key, s]));
    const ns = new Map(p.sections.map((s) => [s.key, s]));
    const ost = stepsOf(o);
    const nst = stepsOf(p);
    const ocards = new Set(o.cards);
    const ncards = new Set(p.cards);
    const change: PageChange = {
      key,
      title: p.title,
      changedSections: [...ns.keys()].filter(
        (k) => os.has(k) && os.get(k)!.hash !== ns.get(k)!.hash,
      ),
      addedSections: [...ns.keys()].filter((k) => !os.has(k)),
      removedSections: [...os.keys()].filter((k) => !ns.has(k)),
      addedSteps: [...nst].filter((k) => !ost.has(k)),
      removedSteps: [...ost].filter((k) => !nst.has(k)),
      addedCards: [...ncards].filter((k) => !ocards.has(k)).length,
      removedCards: [...ocards].filter((k) => !ncards.has(k)).length,
    };
    diff.changedPages.push(change);
    for (const s of change.removedSections)
      diff.removedKeys.push({ pageKey: key, kind: "section", key: s });
    for (const s of change.removedSteps)
      diff.removedKeys.push({ pageKey: key, kind: "step", key: s });
    for (const c of ocards)
      if (!ncards.has(c)) diff.removedKeys.push({ pageKey: key, kind: "card", key: c });
  }
  for (const [key, o] of old) {
    if (!neu.has(key)) {
      diff.removedPages.push(ref(o));
      diff.removedKeys.push({ pageKey: key, kind: "page", key });
    }
  }
  return diff;
}

export function formatDiff(d: ContentDiff): string {
  if (d.identical) return "No changes: the new file is identical to the published one.";
  const lines: string[] = [];
  const list = (title: string, items: string[]) => {
    if (items.length) lines.push(`${title} (${items.length}):`, ...items.map((i) => `  ${i}`));
  };
  list(
    "+ Added pages",
    d.addedPages.map((p) => `${p.key}  ${p.title}`),
  );
  list(
    "↑ Coming soon → published",
    d.nowPublished.map((p) => `${p.key}  ${p.title}`),
  );
  list(
    "↓ Published → coming soon",
    d.nowComingSoon.map((p) => `${p.key}  ${p.title}`),
  );
  list(
    "− Removed pages",
    d.removedPages.map((p) => `${p.key}  ${p.title}`),
  );
  list(
    "~ URL changes (old URLs redirect)",
    d.renamedSlugs.map((r) => `${r.key}: ${r.from} → ${r.to}`),
  );
  list(
    "~ Changed pages",
    d.changedPages.map((c) => {
      const bits = [
        c.changedSections.length && `${c.changedSections.length} section(s) edited`,
        c.addedSections.length && `+${c.addedSections.join(", +")}`,
        c.removedSections.length && `−${c.removedSections.join(", −")}`,
        c.addedSteps.length && `+${c.addedSteps.length} lab step(s)`,
        c.removedSteps.length && `−${c.removedSteps.length} lab step(s)`,
        c.addedCards && `+${c.addedCards} question(s)`,
        c.removedCards && `−${c.removedCards} question(s)`,
      ].filter(Boolean);
      return `${c.key}  ${c.title}: ${bits.join("; ")}`;
    }),
  );
  list(
    "! Keys removed (learner data on these is kept but no longer shown)",
    d.removedKeys.map((k) => `${k.kind} ${k.pageKey}/${k.key}`),
  );
  list("! Warnings", d.warnings);
  return lines.join("\n") || "Only formatting changes; no structural differences.";
}
