import { describe, expect, it } from "vitest";
import { toHtml } from "hast-util-to-html";
import { fromMarkdown } from "mdast-util-from-markdown";
import { toHast } from "mdast-util-to-hast";
import { isAbbreviationOf, termForms, termMatcher } from "./glossary";
import { markTerms } from "./render";

describe("termForms", () => {
  it.each([
    ["Asynchronous (async)", ["asynchronous", "async"]],
    ["Pull request (PR)", ["pull request", "pr"]],
    ["OpenTelemetry (OTel)", ["opentelemetry", "otel"]],
    ["Array (NumPy)", ["array"]],
    ["Percentile (p95)", ["percentile"]],
    ["False positive / negative", ["false negative", "false positive"]],
    ["Query, Key, Value", ["query", "value", "key"]],
    ["Closed / hosted model", ["hosted model", "closed"]],
    ["Edge / conditional edge", ["conditional edge", "edge"]],
    ["`merge` / join", ["merge", "join"]],
    ["429 / 529", []],
    ["CI/CD", ["ci/cd"]],
  ])("%s", (term, forms) => expect(termForms(term)).toEqual(forms));
});

describe("isAbbreviationOf", () => {
  it("accepts ordered subsequences that start with the same letter", () => {
    expect(isAbbreviationOf("repo", "Repository")).toBe(true);
    expect(isAbbreviationOf("NER", "Named Entity Recognition")).toBe(true);
    expect(isAbbreviationOf("Jupyter", "Notebook")).toBe(false);
    expect(isAbbreviationOf("classical", "Token")).toBe(false);
  });
});

describe("termMatcher + markTerms", () => {
  const html = (md: string, terms: string[]) => {
    const tree = fromMarkdown(md);
    markTerms(tree.children, termMatcher(terms)!, new Set());
    return toHtml(toHast(tree));
  };

  it("marks only the first use of each term, longest form first", () => {
    expect(
      html("A false positive is a positive. Another false positive.", [
        "False positive / negative",
        "Positive",
      ]),
    ).toBe(
      '<p>A <button type="button" class="term-ref" data-term="false positive / negative">false positive</button> is a <button type="button" class="term-ref" data-term="positive">positive</button>. Another false positive.</p>',
    );
  });

  it("matches whole words only, case-insensitively, and aliases share one id", () => {
    expect(html("Async code; asynchronous I/O; asyncio.", ["Asynchronous (async)"])).toBe(
      '<p><button type="button" class="term-ref" data-term="asynchronous (async)">Async</button> code; asynchronous I/O; asyncio.</p>',
    );
  });

  it("never marks headings, links or code", () => {
    const out = html("## Token\n\n[a token](https://x.test) and `token` then token.", ["Token"]);
    expect(out.match(/term-ref/g)).toHaveLength(1);
    expect(out).toContain(
      'then <button type="button" class="term-ref" data-term="token">token</button>.',
    );
  });

  it("ignores very short forms", () => {
    expect(termMatcher(["Pull request (PR)"])!.regex.test("a PR")).toBe(false);
    expect(termMatcher(["AI"])).toBeNull();
  });
});
