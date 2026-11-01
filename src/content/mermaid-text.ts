// Generates alt text and a plain-text description of a Mermaid diagram, so every
// diagram is understandable without seeing it (WCAG 1.1.1). Handles the two diagram
// types the handbook uses — flowchart and sequenceDiagram — and degrades to a list
// of labels for anything else.

export interface DiagramText {
  alt: string;
  description: string;
}

const NODE_SHAPES: [RegExp, number][] = [
  [/^([A-Za-z0-9_]+)\[\((.*?)\)\]/, 2], // database [(label)]
  [/^([A-Za-z0-9_]+)\(\((.*?)\)\)/, 2], // circle ((label))
  [/^([A-Za-z0-9_]+)\[\[(.*?)\]\]/, 2], // subroutine [[label]]
  [/^([A-Za-z0-9_]+)\{\{(.*?)\}\}/, 2], // hexagon {{label}}
  [/^([A-Za-z0-9_]+)\[(.*?)\]/, 2],
  [/^([A-Za-z0-9_]+)\((.*?)\)/, 2],
  [/^([A-Za-z0-9_]+)\{(.*?)\}/, 2],
  [/^([A-Za-z0-9_]+)>(.*?)\]/, 2],
];

function cleanLabel(label: string): string {
  return label
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/^["']|["']$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Parses one node reference like `A[Label]` or `A`, returning id, label and rest of line. */
function readNode(text: string, labels: Map<string, string>): { id: string; rest: string } | null {
  const s = text.trimStart();
  for (const [re] of NODE_SHAPES) {
    const m = s.match(re);
    if (m && m[1] !== undefined && m[2] !== undefined) {
      labels.set(m[1], cleanLabel(m[2]));
      return { id: m[1], rest: s.slice(m[0].length) };
    }
  }
  const bare = s.match(/^([A-Za-z0-9_]+)/);
  if (bare && bare[1] !== undefined) return { id: bare[1], rest: s.slice(bare[0].length) };
  return null;
}

// Edge operators with optional inline label: `-- text -->`, `-->|text|`, `-.->`, `==>`, `---`, `--o`.
const EDGE =
  /^\s*(?:(--|-\.|==)\s+(.+?)\s+(-->|-\.->|==>|---|--o|--x)|(-->|-\.->|==>|---|--o|--x|-\.-)(?:\|(.+?)\|)?)\s*/;

function describeFlowchart(lines: string[]): DiagramText {
  const labels = new Map<string, string>();
  const order: string[] = [];
  const edges: { from: string; to: string; label?: string }[] = [];
  const groups: string[] = [];
  const direction = /\bLR\b|\bRL\b/.test(lines[0] ?? "") ? "left to right" : "top to bottom";

  const seen = (id: string) => {
    if (!order.includes(id)) order.push(id);
  };

  for (const raw of lines.slice(1)) {
    const line = raw.trim();
    if (
      !line ||
      line.startsWith("%%") ||
      line === "end" ||
      /^(style|classDef|class|linkStyle|click)\b/.test(line)
    )
      continue;
    const sub = line.match(/^subgraph\s+(?:[A-Za-z0-9_]+\s*)?(?:\[(.*)\]|(.*))$/);
    if (sub) {
      groups.push(cleanLabel(sub[1] ?? sub[2] ?? ""));
      continue;
    }
    // Statements may be chained with `&` or `;` rarely; the handbook uses one edge chain per line.
    let first = readNode(line, labels);
    if (!first) continue;
    seen(first.id);
    let rest = first.rest;
    for (;;) {
      const e = rest.match(EDGE);
      if (!e) break;
      const label = e[2] ?? e[5];
      rest = rest.slice(e[0].length);
      const next = readNode(rest, labels);
      if (!next) break;
      seen(next.id);
      edges.push({ from: first.id, to: next.id, label: label ? cleanLabel(label) : undefined });
      first = next;
      rest = next.rest;
    }
  }

  const name = (id: string) => labels.get(id) ?? id;
  const start = order[0] ? name(order[0]) : "start";
  const alt = `Flowchart, ${direction}, ${order.length} steps, starting at "${start}". Full description follows.`;
  const parts: string[] = [];
  if (groups.length) parts.push(`Groups: ${groups.filter(Boolean).join("; ")}.`);
  for (const e of edges) {
    parts.push(
      e.label
        ? `${name(e.from)} → (${e.label}) → ${name(e.to)}.`
        : `${name(e.from)} → ${name(e.to)}.`,
    );
  }
  const unconnected = order.filter((id) => !edges.some((e) => e.from === id || e.to === id));
  for (const id of unconnected) parts.push(`${name(id)}.`);
  return { alt, description: parts.join("\n") };
}

function describeSequence(lines: string[]): DiagramText {
  const names = new Map<string, string>();
  const steps: string[] = [];
  for (const raw of lines.slice(1)) {
    const line = raw.trim();
    const p = line.match(/^(?:participant|actor)\s+(\S+)(?:\s+as\s+(.+))?$/);
    if (p && p[1]) {
      names.set(p[1], cleanLabel(p[2] ?? p[1]));
      continue;
    }
    const m = line.match(/^(\S+?)\s*(-->>|->>|-->|->|--x|-x|--\)|-\))\s*([+-]?)(\S+?)\s*:\s*(.*)$/);
    if (m && m[1] && m[4]) {
      const from = names.get(m[1]) ?? m[1];
      const to = names.get(m[4]) ?? m[4];
      steps.push(`${from} → ${to}: ${cleanLabel(m[5] ?? "")}`);
      continue;
    }
    const note = line.match(/^Note\s+(?:over|left of|right of)\s+([^:]+):\s*(.*)$/i);
    if (note && note[2]) steps.push(`Note: ${cleanLabel(note[2])}`);
    const block = line.match(/^(loop|alt|else|opt|par)\s*(.*)$/);
    if (block && block[1]) steps.push(`${block[1]}${block[2] ? ` ${cleanLabel(block[2])}` : ""}:`);
  }
  const who = [...names.values()];
  return {
    alt: `Sequence diagram between ${who.join(", ")}, ${steps.length} steps. Full description follows.`,
    description: steps.map((s, i) => `${i + 1}. ${s}`).join("\n"),
  };
}

export function describeMermaid(source: string): DiagramText {
  const lines = source.split("\n").filter((l) => l.trim().length > 0);
  const explicitAlt = lines
    .map((l) => l.trim().match(/^%%\s*alt:\s*(.+)$/i)?.[1])
    .find((a): a is string => Boolean(a));
  const body = lines.filter((l) => !/^\s*%%/.test(l));
  const head = body[0]?.trim() ?? "";
  let text: DiagramText;
  if (/^(flowchart|graph)\b/.test(head)) text = describeFlowchart(body);
  else if (/^sequenceDiagram\b/.test(head)) text = describeSequence(body);
  else
    text = {
      alt: "Diagram. Full description follows.",
      description: body
        .slice(1)
        .map((l) => l.trim())
        .join("\n"),
    };
  return explicitAlt ? { ...text, alt: explicitAlt.trim() } : text;
}
