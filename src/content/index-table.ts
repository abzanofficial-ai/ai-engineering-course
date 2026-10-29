import type { Table, TableCell, PhrasingContent } from "mdast";
import { toString } from "mdast-util-to-string";

export interface IndexItem {
  kind: "chapter" | "appendix";
  /** Chapter number, or appendix letter. */
  id: number | string;
  title: string;
  linked: boolean;
}

export interface IndexRow {
  partNumber: number;
  partTitle: string;
  items: IndexItem[];
}

/**
 * Splits a cell's inline nodes into items separated by " · ", keeping track of which
 * items contain a link. A link marks the chapter as published in the book's own index.
 */
function cellItems(cell: TableCell): { text: string; linked: boolean }[] {
  const items: { text: string; linked: boolean }[] = [{ text: "", linked: false }];
  const walk = (nodes: PhrasingContent[], inLink: boolean) => {
    for (const node of nodes) {
      if (node.type === "text" || node.type === "inlineCode") {
        const parts = node.value.split("·");
        parts.forEach((part, i) => {
          if (i > 0) items.push({ text: "", linked: false });
          const cur = items[items.length - 1]!;
          cur.text += part;
          if (inLink && part.trim()) cur.linked = true;
        });
      } else if ("children" in node) {
        walk(node.children as PhrasingContent[], inLink || node.type === "link");
      }
    }
  };
  walk(cell.children, false);
  return items
    .map((i) => ({ text: i.text.replace(/\s+/g, " ").trim(), linked: i.linked }))
    .filter((i) => i.text.length > 0);
}

export function parseIndexTable(table: Table): { rows: IndexRow[]; warnings: string[] } {
  const rows: IndexRow[] = [];
  const warnings: string[] = [];
  for (const row of table.children.slice(1)) {
    const [partCell, chapterCell] = row.children;
    if (!partCell || !chapterCell) continue;
    const partText = toString(partCell).trim();
    const partMatch = partText.match(/^(\d+)\.\s*(.+)$/);
    const partNumber = partMatch ? Number(partMatch[1]) : 0;
    const partTitle = partMatch ? (partMatch[2] ?? "").trim() : partText;
    const items: IndexItem[] = [];
    for (const item of cellItems(chapterCell)) {
      const ch = item.text.match(/^(\d+)\.\s*(.+)$/);
      const ap = item.text.match(/^Appendix\s+([A-Z])\s*[:.—-]\s*(.+)$/i);
      if (ch)
        items.push({
          kind: "chapter",
          id: Number(ch[1]),
          title: ch[2]!.trim(),
          linked: item.linked,
        });
      else if (ap)
        items.push({
          kind: "appendix",
          id: ap[1]!.toUpperCase(),
          title: ap[2]!.trim(),
          linked: item.linked,
        });
      else warnings.push(`Index: could not read entry "${item.text}" in part "${partText}"`);
    }
    rows.push({ partNumber, partTitle, items });
  }
  return { rows, warnings };
}
