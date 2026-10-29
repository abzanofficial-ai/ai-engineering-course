import type { Element, ElementContent, Root as HastRoot } from "hast";
import { toHtml } from "hast-util-to-html";
import { h } from "hastscript";
import type { Code, Heading, Root, RootContent, Text, PhrasingContent } from "mdast";
import { toHast } from "mdast-util-to-hast";
import { toString } from "mdast-util-to-string";
import { bundledLanguages, createHighlighter, type Highlighter } from "shiki";
import { visit } from "unist-util-visit";
import { hash, slugify } from "./keys";
import { describeMermaid } from "./mermaid-text";
import type { Diagram, DiagramRenders } from "./types";

const THEMES = { light: "github-light-high-contrast", dark: "github-dark-high-contrast" } as const;

export interface RenderContext {
  highlighter: Highlighter;
  diagrams: Map<string, Diagram>;
  renders: DiagramRenders;
  /** Public URL prefix for rendered SVGs, e.g. "/diagrams". */
  diagramBase: string;
}

export async function createRenderContext(
  tree: Root,
  renders: DiagramRenders,
  diagramBase = "/diagrams",
): Promise<RenderContext> {
  const langs = new Set<string>();
  visit(tree, "code", (node: Code) => {
    if (node.lang && node.lang !== "mermaid" && node.lang in bundledLanguages) langs.add(node.lang);
  });
  const highlighter = await createHighlighter({
    themes: [THEMES.light, THEMES.dark],
    langs: [...langs].sort(),
  });
  return { highlighter, diagrams: new Map(), renders, diagramBase };
}

/** Mermaid sources in document order, for the render step. */
export function collectMermaid(tree: Root): string[] {
  const out: string[] = [];
  visit(tree, "code", (node: Code) => {
    if (node.lang === "mermaid") out.push(node.value);
  });
  return out;
}

export function diagramHash(source: string): string {
  return hash(source.trim(), 16);
}

function shellCopyMode(lang: string, value: string): "shell" | "all" {
  return lang === "bash" && /^\$ /m.test(value) ? "shell" : "all";
}

function renderCode(node: Code, ctx: RenderContext): Element {
  const lang = node.lang && node.lang in bundledLanguages ? node.lang : "text";
  const label = node.lang && node.lang !== "text" ? node.lang : "text";
  const highlighted = ctx.highlighter.codeToHast(node.value, {
    lang,
    themes: THEMES,
    defaultColor: false,
  });
  const pre = highlighted.children.find((c): c is Element => c.type === "element");
  // Shiki already makes <pre> focusable (tabindex=0) so keyboard users can scroll it.
  if (pre) delete pre.properties.style;
  return h("figure.code", { dataLang: label, dataCopyMode: shellCopyMode(lang, node.value) }, [
    h("div.code-header", [
      h("span.code-lang", label),
      h(
        "button.code-copy",
        { type: "button", dataCopy: "", ariaLabel: `Copy ${label} code` },
        "Copy",
      ),
    ]),
    ...(pre ? [pre] : []),
  ]);
}

function renderMermaid(node: Code, ctx: RenderContext): Element {
  const source = node.value.trim();
  const id = diagramHash(source);
  const text = describeMermaid(source);
  ctx.diagrams.set(id, { hash: id, source, alt: text.alt, description: text.description });
  const size = ctx.renders[id];
  const visual: ElementContent[] = size
    ? (["light", "dark"] as const).map((theme) =>
        h(`img.diagram-${theme}`, {
          src: `${ctx.diagramBase}/${id}-${theme}.svg`,
          alt: text.alt,
          width: size.width,
          height: size.height,
          loading: "lazy",
          decoding: "async",
        }),
      )
    : [h("pre.diagram-source", { tabIndex: 0, ariaLabel: text.alt }, source)];
  return h("figure.diagram", { dataDiagram: id }, [
    ...visual,
    h("details.diagram-text", [
      h("summary", "Diagram as text"),
      h("p", { style: "white-space: pre-line" }, text.description),
    ]),
  ]);
}

/**
 * Rewrites headings inside a section: book depth 4 → h3 etc., with ids prefixed by the
 * section key so anchors are unique on the page.
 */
export function prepareHeadings(nodes: RootContent[], idPrefix: string, used: Set<string>): void {
  for (const node of nodes) {
    if (node.type !== "heading") continue;
    const heading = node as Heading;
    let id = `${idPrefix}-${slugify(toString(heading)) || "section"}`;
    let n = 2;
    while (used.has(id)) id = `${idPrefix}-${slugify(toString(heading))}-${n++}`;
    used.add(id);
    heading.depth = Math.max(3, heading.depth - 1) as Heading["depth"];
    heading.data = { ...heading.data, hProperties: { ...heading.data?.hProperties, id } };
  }
}

/** Splits `[placeholder]` text into <mark class="placeholder"> nodes (used in prompts). */
export function markPlaceholders(nodes: RootContent[]): void {
  const root: Root = { type: "root", children: nodes };
  visit(root, "text", (node: Text, index, parent) => {
    if (!parent || index === undefined || !/\[[^\]]+\]/.test(node.value)) return;
    const pieces: PhrasingContent[] = [];
    let last = 0;
    for (const m of node.value.matchAll(/\[[^\]]+\]/g)) {
      const at = m.index ?? 0;
      if (at > last) pieces.push({ type: "text", value: node.value.slice(last, at) });
      pieces.push({
        type: "emphasis",
        data: { hName: "mark", hProperties: { className: ["placeholder"] } },
        children: [{ type: "text", value: m[0] }],
      } as PhrasingContent);
      last = at + m[0].length;
    }
    if (last < node.value.length) pieces.push({ type: "text", value: node.value.slice(last) });
    (parent.children as PhrasingContent[]).splice(index, 1, ...pieces);
    return index + pieces.length;
  });
}

function transformHast(tree: HastRoot): void {
  visit(tree, "element", (node: Element, index, parent) => {
    if (node.tagName === "a") {
      const href = String(node.properties.href ?? "");
      if (href.startsWith("#") && parent && index !== undefined) {
        // Google Docs export anchors (#mr7xe79p9rt.…) point nowhere: keep the text, drop the link.
        parent.children.splice(index, 1, ...node.children);
        return index;
      }
      if (/^https?:/.test(href)) node.properties.rel = ["noopener", "noreferrer"];
    }
    if (node.tagName === "table" && parent && index !== undefined && parent.type === "root") {
      parent.children[index] = h(
        "div.table-wrap",
        { tabIndex: 0, role: "region", ariaLabel: "Table (scrolls sideways)" },
        [node],
      );
      return "skip";
    }
    return undefined;
  });
}

/** Renders a slice of top-level mdast nodes to an HTML string. */
export function renderNodes(nodes: RootContent[], ctx: RenderContext): string {
  if (nodes.length === 0) return "";
  const root: Root = { type: "root", children: nodes };
  const tree = toHast(root, {
    allowDangerousHtml: false,
    handlers: {
      code: (_state, node: Code) =>
        node.lang === "mermaid" ? renderMermaid(node, ctx) : renderCode(node, ctx),
    },
  }) as HastRoot;
  transformHast(tree);
  return toHtml(tree);
}

export function renderInline(children: PhrasingContent[], ctx: RenderContext): string {
  const html = renderNodes([{ type: "paragraph", children }], ctx);
  return html.replace(/^<p>/, "").replace(/<\/p>$/, "");
}
