// Turns a jargon-decoder term cell into the forms we match in running text.
// "Asynchronous (async)" → asynchronous, async     (abbreviation: alias)
// "Array (NumPy)"        → array                   (qualifier: not an alias)
// "False positive / negative" → false positive, false negative
// "Closed / hosted model" → closed, hosted model   (kept as written: no guessing)
// "Query, Key, Value"    → query, key, value

/** True when `short` is an ordered subsequence of `long`'s letters, starting with the same letter. */
export function isAbbreviationOf(short: string, long: string): boolean {
  const s = short.toLowerCase().replace(/[^a-z0-9]/g, "");
  const l = long.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!s || !l || s[0] !== l[0] || s.length >= l.length) return false;
  let i = 0;
  for (const ch of l) if (ch === s[i]) i++;
  return i === s.length;
}

function expandSlashes(text: string): string[] {
  if (!/\s\/\s|,\s/.test(text)) return [text];
  const parts = text
    .split(/\s*\/\s*|,\s*/)
    .map((p) => p.trim())
    .filter(Boolean);
  const first = parts[0] ?? "";
  const firstWords = first.split(/\s+/);
  const out = [first];
  for (const p of parts.slice(1)) {
    // "False positive / negative" → "False negative"; otherwise keep each part as written.
    if (firstWords.length > 1 && !p.includes(" "))
      out.push([...firstWords.slice(0, -1), p].join(" "));
    else out.push(p);
  }
  return out;
}

export function termForms(term: string): string[] {
  const clean = term.replace(/`/g, "").replace(/\s+/g, " ").trim();
  const forms = new Set<string>();
  const paren = clean.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  const main = paren ? (paren[1] ?? clean) : clean;
  if (paren && paren[2] && isAbbreviationOf(paren[2], main)) forms.add(paren[2]);
  for (const f of expandSlashes(main)) forms.add(f);
  return [...forms]
    .map((f) => f.toLowerCase().trim())
    .filter((f) => f.length >= 2 && !/^\d+$/.test(f))
    .sort((a, b) => b.length - a.length || a.localeCompare(b));
}

/** Display name: drop markdown punctuation but keep the author's wording. */
export function termDisplay(term: string): string {
  return term.replace(/`/g, "").replace(/\s+/g, " ").trim();
}

/** Lower-cased display name: the id the reader uses to find a term's glossary entry. */
export const termId = (term: string) => termDisplay(term).toLowerCase();

export interface TermMatcher {
  regex: RegExp;
  /** The term id a matched form belongs to. */
  idOf: (match: string) => string | undefined;
}

/**
 * Builds one case-insensitive matcher for a chapter's own jargon terms. Longer forms win
 * ("false positive" before "positive"), and a match never starts or ends inside a word.
 */
export function termMatcher(terms: string[]): TermMatcher | null {
  const byForm = new Map<string, string>();
  for (const t of terms)
    for (const f of termForms(t)) if (f.length >= 3 && !byForm.has(f)) byForm.set(f, termId(t));
  if (byForm.size === 0) return null;
  const forms = [...byForm.keys()].sort((a, b) => b.length - a.length || a.localeCompare(b));
  const escaped = forms.map((f) => f.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return {
    regex: new RegExp(`(?<![\\p{L}\\p{N}_-])(?:${escaped.join("|")})(?![\\p{L}\\p{N}_-])`, "giu"),
    idOf: (m) => byForm.get(m.toLowerCase()),
  };
}
