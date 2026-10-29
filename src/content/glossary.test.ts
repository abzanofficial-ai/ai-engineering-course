import { describe, expect, it } from "vitest";
import { isAbbreviationOf, termForms } from "./glossary";

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
