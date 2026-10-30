import type { Heading, List, ListItem, Paragraph, Root, RootContent, Table } from "mdast";
import { fromMarkdown } from "mdast-util-from-markdown";
import { gfmFromMarkdown } from "mdast-util-gfm";
import { toString } from "mdast-util-to-string";
import { gfm } from "micromark-extension-gfm";
import { termDisplay, termForms } from "./glossary";
import { parseIndexTable, type IndexRow } from "./index-table";
import { appendixKey, cardKey, chapterKey, hash, slugify, startKey, stepKey } from "./keys";
import {
  collectMermaid,
  createRenderContext,
  markPlaceholders,
  prepareHeadings,
  renderInline,
  renderNodes,
  type RenderContext,
} from "./render";
import type {
  Block,
  Card,
  CourseBuild,
  DiagramRenders,
  GlossaryEntry,
  Page,
  PageKind,
  Part,
  SearchRecord,
  Section,
  SectionMeta,
  SectionType,
} from "./types";

export interface CourseConfig {
  slug: string;
  title?: string;
}

const WORDS_PER_MINUTE = 220;

export function parseMarkdown(markdown: string): Root {
  return fromMarkdown(markdown, { extensions: [gfm()], mdastExtensions: [gfmFromMarkdown()] });
}

export function mermaidSources(markdown: string): string[] {
  return collectMermaid(parseMarkdown(markdown));
}

// ---------------------------------------------------------------------------
// Small mdast helpers

const isHeading = (n: RootContent, depth?: number): n is Heading =>
  n.type === "heading" && (depth === undefined || n.depth === depth);

/** A paragraph whose first child is bold text starting with `prefix` (case-insensitive). */
function isLeadParagraph(n: RootContent, prefix: RegExp): n is Paragraph {
  if (n.type !== "paragraph") return false;
  const first = n.children[0];
  return first?.type === "strong" && prefix.test(toString(first).trim());
}

function proseWords(nodes: RootContent[]): number {
  let words = 0;
  const count = (n: RootContent | Root) => {
    if (n.type === "code") return;
    if (n.type === "text" || n.type === "inlineCode") {
      words += n.value.split(/\s+/).filter(Boolean).length;
      return;
    }
    if ("children" in n) for (const c of n.children) count(c as RootContent);
  };
  nodes.forEach(count);
  return words;
}

function plainText(nodes: RootContent[]): string {
  return nodes
    .map((n) => (n.type === "code" && n.lang === "mermaid" ? "" : toString(n)))
    .filter(Boolean)
    .join("\n")
    .replace(/\s+/g, " ")
    .trim();
}

/** "about 2.5 hours" → 150; "about 45 minutes" → 45. */
export function parseMinutes(text: string): number {
  const m = text.match(/(\d+(?:\.\d+)?)\s*(hours?|minutes?|mins?)/i);
  if (!m) return 0;
  const value = Number(m[1]);
  return Math.round(/^h/i.test(m[2] ?? "") ? value * 60 : value);
}

// ---------------------------------------------------------------------------
// Section classification

const SECTION_TYPES: [RegExp, SectionType][] = [
  [/^jargon decoder/i, "jargon"],
  [/^interview questions/i, "interview"],
  [/^practice lab/i, "lab"],
  [/^decision drill/i, "drill"],
  [/^stuck\?\s*ask claude/i, "stuck"],
  [/^where the judgment is/i, "judgment"],
  [/^further reading/i, "further-reading"],
];

export function classifySection(title: string): SectionType {
  return SECTION_TYPES.find(([re]) => re.test(title))?.[1] ?? "prose";
}

// ---------------------------------------------------------------------------
// Raw document segmentation

interface RawPage {
  kind: PageKind;
  number?: number;
  letter?: string;
  title: string;
  partNumber: number;
  nodes: RootContent[];
}

interface RawPart {
  number: number;
  title: string;
  intro: RootContent[];
}

interface Segments {
  title: string;
  pages: RawPage[];
  parts: RawPart[];
  index: Table | null;
  warnings: string[];
}

function segment(tree: Root): Segments {
  const out: Segments = { title: "", pages: [], parts: [], index: null, warnings: [] };
  let part: RawPart | null = null;
  let page: RawPage | null = null;
  let inIndex = false;

  for (const node of tree.children) {
    if (isHeading(node, 1)) {
      const text = toString(node).trim();
      const m = text.match(/^Part\s+(\d+)\s*[—–:-]\s*(.+)$/);
      if (m) {
        part = { number: Number(m[1]), title: m[2]!.trim(), intro: [] };
        out.parts.push(part);
        page = null;
        inIndex = false;
      } else if (!out.title) {
        out.title = text;
      } else {
        out.warnings.push(`Unexpected top-level heading "${text}" — treated as text`);
        page?.nodes.push(node);
      }
      continue;
    }
    if (isHeading(node, 2)) {
      const text = toString(node).trim();
      inIndex = false;
      const ch = text.match(/^Chapter\s+(\d+)\s*[:.—–-]\s*(.+)$/);
      const ap = text.match(/^Appendix\s+([A-Z])\s*[:.—–-]\s*(.+)$/i);
      if (ch) {
        page = {
          kind: "chapter",
          number: Number(ch[1]),
          title: ch[2]!.trim(),
          partNumber: part?.number ?? 0,
          nodes: [],
        };
      } else if (ap) {
        page = {
          kind: "appendix",
          letter: ap[1]!.toUpperCase(),
          title: ap[2]!.trim(),
          partNumber: part?.number ?? 0,
          nodes: [],
        };
      } else if (/^index$/i.test(text)) {
        page = null;
        inIndex = true;
        continue;
      } else if (!part) {
        page = { kind: "start", title: text, partNumber: 0, nodes: [] };
      } else {
        out.warnings.push(
          `Section "${text}" inside Part ${part.number} is not a chapter — shown as a page`,
        );
        page = { kind: "start", title: text, partNumber: part.number, nodes: [] };
      }
      out.pages.push(page);
      continue;
    }
    if (inIndex) {
      if (node.type === "table" && !out.index) out.index = node;
      continue;
    }
    if (page) page.nodes.push(node);
    else if (part) part.intro.push(node);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Section builders

interface BuiltSection {
  section: Section;
  meta: SectionMeta;
  text: string;
  cards: Card[];
  terms: { term: string; html: string; text: string }[];
}

function buildLab(nodes: RootContent[], key: string, ctx: RenderContext, used: Set<string>) {
  const blocks: Block[] = [];
  const steps: NonNullable<SectionMeta["steps"]> = [];
  let labMinutes = 0;
  let hasCommit = false;

  const groups: { heading: Heading | null; nodes: RootContent[] }[] = [
    { heading: null, nodes: [] },
  ];
  for (const n of nodes) {
    if (isHeading(n, 4)) groups.push({ heading: n, nodes: [] });
    else groups[groups.length - 1]!.nodes.push(n);
  }

  for (const g of groups) {
    if (!g.heading) {
      const time = g.nodes.find((n) => isLeadParagraph(n, /^time:/i));
      if (time) labMinutes = parseMinutes(toString(time));
      prepareHeadings(g.nodes, key, used);
      const html = renderNodes(g.nodes, ctx);
      if (html) blocks.push({ kind: "html", html });
      continue;
    }
    const title = toString(g.heading).trim();
    const step = title.match(/^Step\s+(\d+[a-z]?)\s*[—–:-]\s*(.+)$/i);
    if (step) {
      const label = step[1]!.toLowerCase();
      const sk = stepKey(label);
      prepareHeadings(g.nodes, `${key}-${sk}`, used);
      steps.push({ key: sk, label, title: step[2]!.trim() });
      blocks.push({
        kind: "lab-step",
        key: sk,
        label,
        title: step[2]!.trim(),
        anchor: `${key}-${sk}`,
        html: renderNodes(g.nodes, ctx),
      });
      continue;
    }
    if (/^when it breaks/i.test(title)) {
      prepareHeadings(g.nodes, `${key}-troubleshoot`, used);
      blocks.push({ kind: "lab-troubleshoot", title, html: renderNodes(g.nodes, ctx) });
      continue;
    }
    if (/^commit it/i.test(title)) {
      hasCommit = true;
      prepareHeadings(g.nodes, `${key}-commit`, used);
      blocks.push({ kind: "lab-commit", html: renderNodes(g.nodes, ctx) });
      continue;
    }
    // Any other #### (e.g. "You now have", "SQLite vs Postgres"). Chapters 1–6 put the
    // commit instructions in a bold "Commit it…" paragraph inside one of these.
    const commitAt = g.nodes.findIndex((n) => isLeadParagraph(n, /^commit it/i));
    const before = commitAt >= 0 ? g.nodes.slice(0, commitAt) : g.nodes;
    const heading: RootContent = g.heading;
    prepareHeadings([heading, ...before], key, used);
    blocks.push({ kind: "html", html: renderNodes([heading, ...before], ctx) });
    if (commitAt >= 0) {
      hasCommit = true;
      const commitNodes = g.nodes.slice(commitAt);
      prepareHeadings(commitNodes, `${key}-commit`, used);
      blocks.push({ kind: "lab-commit", html: renderNodes(commitNodes, ctx) });
    }
  }
  return { blocks, steps, labMinutes, hasCommit };
}

function buildSection(
  type: SectionType,
  key: string,
  title: string,
  nodes: RootContent[],
  pageKey: string,
  ctx: RenderContext,
  used: Set<string>,
): BuiltSection {
  const text = plainText(nodes);
  const cards: Card[] = [];
  const terms: BuiltSection["terms"] = [];
  let blocks: Block[] = [];
  const meta: SectionMeta = { key, type, title, hash: "" };

  if (type === "lab") {
    const lab = buildLab(nodes, key, ctx, used);
    blocks = lab.blocks;
    meta.steps = lab.steps;
    meta.labMinutes = lab.labMinutes;
    meta.hasCommit = lab.hasCommit;
  } else if (type === "drill") {
    const at = nodes.findIndex((n) => isLeadParagraph(n, /^how an experienced engineer reasons/i));
    prepareHeadings(nodes, key, used);
    const before = at >= 0 ? nodes.slice(0, at) : nodes;
    blocks.push({ kind: "html", html: renderNodes(before, ctx) });
    if (at >= 0) blocks.push({ kind: "drill-reveal", html: renderNodes(nodes.slice(at), ctx) });
  } else if (type === "interview" || type === "stuck") {
    prepareHeadings(nodes, key, used);
    let pending: RootContent[] = [];
    const flush = () => {
      if (pending.length) blocks.push({ kind: "html", html: renderNodes(pending, ctx) });
      pending = [];
    };
    for (const n of nodes) {
      if (n.type !== "list") {
        pending.push(n);
        continue;
      }
      flush();
      for (const item of (n as List).children) {
        const itemText = toString(item).replace(/\s+/g, " ").trim();
        if (type === "stuck") markPlaceholders(item.children);
        const html = renderNodes((item as ListItem).children, ctx);
        if (type === "interview") {
          const card: Card = { key: cardKey(pageKey, itemText), pageKey, text: itemText, html };
          cards.push(card);
          blocks.push({ kind: "card", key: card.key, html, text: itemText });
        } else {
          blocks.push({ kind: "prompt", html, text: itemText.replace(/^["“”]+|["“”]+$/g, "") });
        }
      }
    }
    flush();
  } else {
    if (type === "jargon") {
      for (const n of nodes) {
        if (n.type !== "table") continue;
        for (const row of n.children.slice(1)) {
          const [termCell, defCell] = row.children;
          if (!termCell || !defCell) continue;
          const term = toString(termCell).trim();
          if (!term) continue;
          terms.push({
            term,
            html: renderInline(defCell.children, ctx),
            text: toString(defCell).trim(),
          });
        }
      }
    }
    prepareHeadings(nodes, key, used);
    blocks.push({ kind: "html", html: renderNodes(nodes, ctx) });
  }

  blocks = blocks.filter((b) => b.kind !== "html" || b.html.length > 0);
  meta.hash = hash(JSON.stringify(blocks));
  return { section: { key, type, title, blocks }, meta, text, cards, terms };
}

// ---------------------------------------------------------------------------
// Page builder

function pageKeyOf(raw: RawPage): string {
  if (raw.kind === "chapter") return chapterKey(raw.number!);
  if (raw.kind === "appendix") return appendixKey(raw.letter!);
  return startKey(raw.title);
}

function pageSlug(raw: {
  kind: PageKind;
  number?: number;
  letter?: string;
  title: string;
}): string {
  if (raw.kind === "chapter") return `${raw.number}-${slugify(raw.title)}`;
  if (raw.kind === "appendix") return `appendix-${raw.letter!.toLowerCase()}-${slugify(raw.title)}`;
  return slugify(raw.title);
}

function pageLabel(raw: { kind: PageKind; number?: number; letter?: string }): string {
  if (raw.kind === "chapter") return `Chapter ${raw.number}`;
  if (raw.kind === "appendix") return `Appendix ${raw.letter}`;
  return "";
}

interface BuiltPage {
  page: Page;
  cards: Card[];
  terms: { term: string; html: string; text: string }[];
  search: SearchRecord[];
}

function buildPage(raw: RawPage, courseSlug: string, ctx: RenderContext): BuiltPage {
  const key = pageKeyOf(raw);
  const slug = pageSlug(raw);
  const nodes = [...raw.nodes];

  // The one-line definition is an inline bold paragraph, not a ### section; it may sit
  // after the jargon table. Lift it out to use as the chapter's lede.
  let definitionHtml: string | null = null;
  const defAt = nodes.findIndex((n) => isLeadParagraph(n, /^definition:?$/i));
  if (defAt >= 0) {
    const para = nodes[defAt] as Paragraph;
    nodes.splice(defAt, 1);
    definitionHtml = renderInline(para.children, ctx);
  }

  const groups: { title: string | null; nodes: RootContent[] }[] = [{ title: null, nodes: [] }];
  for (const n of nodes) {
    if (isHeading(n, 3)) groups.push({ title: toString(n).trim(), nodes: [] });
    else groups[groups.length - 1]!.nodes.push(n);
  }

  const used = new Set<string>();
  const typeCount = new Map<string, number>();
  const sections: Section[] = [];
  const metas: SectionMeta[] = [];
  const cards: Card[] = [];
  const terms: BuiltPage["terms"] = [];
  const search: SearchRecord[] = [];
  let words = 0;

  for (const g of groups) {
    if (g.title === null && g.nodes.length === 0) continue;
    const title = g.title ?? "Introduction";
    const type = g.title === null ? "prose" : classifySection(title);
    let sKey: string;
    if (g.title === null) sKey = "intro";
    else if (type !== "prose") {
      const n = (typeCount.get(type) ?? 0) + 1;
      typeCount.set(type, n);
      sKey = n === 1 ? type : `${type}-${n}`;
    } else sKey = slugify(title) || "section";
    let unique = sKey;
    for (let i = 2; used.has(unique); i++) unique = `${sKey}-${i}`;
    used.add(unique);

    const built = buildSection(type, unique, title, g.nodes, key, ctx, used);
    sections.push(built.section);
    metas.push(built.meta);
    cards.push(...built.cards);
    terms.push(...built.terms);
    if (type !== "lab") words += proseWords(g.nodes);
    search.push({
      url: `/learn/${courseSlug}/${slug}#${unique}`,
      pageKey: key,
      sectionKey: unique,
      title,
      pageTitle: raw.title,
      text: built.text,
    });
  }

  const labMinutes = metas.reduce((sum, m) => sum + (m.labMinutes ?? 0), 0);
  const page: Page = {
    key,
    kind: raw.kind,
    number: raw.number,
    label: pageLabel(raw),
    title: raw.title,
    slug,
    partNumber: raw.partNumber,
    status: "published",
    readingMinutes: Math.max(1, Math.ceil(words / WORDS_PER_MINUTE)),
    labMinutes,
    sections: metas,
    cards: cards.map((c) => c.key),
    hash: hash(JSON.stringify([definitionHtml, metas.map((m) => m.hash)])),
    definitionHtml,
    content: sections,
  };
  return { page, cards, terms, search };
}

// ---------------------------------------------------------------------------
// Course assembly

function comingSoonPage(row: IndexRow, item: IndexRow["items"][number]): Page {
  const kind: PageKind = item.kind;
  const raw =
    kind === "chapter"
      ? { kind, number: item.id as number, title: item.title }
      : { kind, letter: item.id as string, title: item.title };
  const title = item.title.replace(/\*/g, "").trim();
  return {
    key: kind === "chapter" ? chapterKey(item.id as number) : appendixKey(item.id as string),
    kind,
    number: kind === "chapter" ? (item.id as number) : undefined,
    label: pageLabel(raw),
    title,
    slug: pageSlug({ ...raw, title }),
    partNumber: row.partNumber,
    status: "coming-soon",
    readingMinutes: 0,
    labMinutes: 0,
    sections: [],
    cards: [],
    hash: "",
    definitionHtml: null,
    content: [],
  };
}

function orderKey(p: Page): [number, number, number] {
  const kindOrder = p.kind === "start" ? 0 : p.kind === "chapter" ? 1 : 2;
  return [p.partNumber, kindOrder, p.number ?? 0];
}

export async function buildCourse(
  markdown: string,
  config: CourseConfig,
  renders: DiagramRenders = {},
): Promise<CourseBuild> {
  const tree = parseMarkdown(markdown);
  const seg = segment(tree);
  const warnings = [...seg.warnings];
  const ctx = await createRenderContext(tree, renders);

  const built = seg.pages.map((raw) => buildPage(raw, config.slug, ctx));
  const pages = new Map<string, Page>();
  for (const b of built) {
    if (pages.has(b.page.key))
      warnings.push(`Duplicate page key ${b.page.key} — later one ignored`);
    else pages.set(b.page.key, b.page);
  }

  // The Index is the only full list of chapters; anything listed but not written is "coming soon".
  const index = seg.index
    ? parseIndexTable(seg.index)
    : { rows: [], warnings: ["No Index table found"] };
  warnings.push(...index.warnings);
  const partTitles = new Map<number, string>([[0, "Start here"]]);
  for (const row of index.rows) {
    if (row.partNumber > 0) partTitles.set(row.partNumber, row.partTitle);
    for (const item of row.items) {
      const key =
        item.kind === "chapter" ? chapterKey(item.id as number) : appendixKey(item.id as string);
      const existing = pages.get(key);
      if (!existing) {
        pages.set(key, comingSoonPage(row, item));
        if (item.linked)
          warnings.push(
            `Index links ${key} but the chapter is not in the file — marked coming soon`,
          );
      } else if (existing.partNumber !== row.partNumber && row.partNumber > 0) {
        warnings.push(
          `${key} is under Part ${existing.partNumber} in the text but Part ${row.partNumber} in the Index`,
        );
      }
    }
  }
  for (const p of seg.parts) partTitles.set(p.number, p.title);
  const outcomes = new Map(index.rows.map((r) => [r.partNumber, r.outcome]));

  const sortedPages = [...pages.values()].sort((a, b) => {
    const [x, y] = [orderKey(a), orderKey(b)];
    return x[0] - y[0] || x[1] - y[1] || x[2] - y[2] || a.key.localeCompare(b.key);
  });

  const parts: Part[] = [...partTitles.entries()]
    .sort(([a], [b]) => a - b)
    .map(([number, title]) => {
      const raw = seg.parts.find((p) => p.number === number);
      if (raw) prepareHeadings(raw.intro, `part-${number}`, new Set());
      return {
        number,
        key: `part-${number}`,
        title,
        introHtml: raw ? renderNodes(raw.intro, ctx) : "",
        outcomeHtml: renderInline(outcomes.get(number) ?? [], ctx),
        milestone: (outcomes.get(number) ?? []).some((n) => n.type === "strong"),
        pages: sortedPages.filter((p) => p.partNumber === number).map((p) => p.key),
      };
    });

  // Glossary: merge the same term from several chapters, keeping every definition.
  const glossary = new Map<string, GlossaryEntry>();
  const slugs = new Set<string>();
  for (const b of built) {
    for (const t of b.terms) {
      const display = termDisplay(t.term);
      const id = display.toLowerCase();
      let entry = glossary.get(id);
      if (!entry) {
        const base = slugify(display.replace(/@/g, "at ")) || "term";
        let slug = base;
        for (let i = 2; slugs.has(slug); i++) slug = `${base}-${i}`;
        slugs.add(slug);
        entry = { slug, term: display, forms: [], definitions: [] };
      }
      entry.forms = [...new Set([...entry.forms, ...termForms(t.term)])].sort(
        (a, b) => b.length - a.length || a.localeCompare(b),
      );
      entry.definitions.push({ pageKey: b.page.key, html: t.html, text: t.text });
      glossary.set(id, entry);
    }
  }

  const pageList = sortedPages;
  return {
    manifest: {
      slug: config.slug,
      title: config.title ?? seg.title,
      sourceHash: hash(markdown),
      parts,
      pages: pageList.map(({ definitionHtml: _d, content: _c, ...meta }) => meta),
      warnings,
    },
    pages: pageList.filter((p) => p.status === "published"),
    glossary: [...glossary.values()].sort((a, b) =>
      a.term.localeCompare(b.term, "en", { sensitivity: "base" }),
    ),
    cards: built.flatMap((b) => b.cards),
    diagrams: [...ctx.diagrams.values()].sort((a, b) => a.hash.localeCompare(b.hash)),
    search: built.flatMap((b) => b.search),
  };
}
