import { describe, expect, it } from "vitest";
import { describeMermaid } from "./mermaid-text";

describe("describeMermaid", () => {
  it("describes flowchart edges with labels and shapes", () => {
    const d = describeMermaid(
      `flowchart TD\n    T{What kind of task?}\n    T -- Learning a concept --> L[Use AI heavily]\n    T -->|Debugging| D[(Logs)]\n    D -.- N[Note]`,
    );
    expect(d.alt).toBe(
      'Flowchart, top to bottom, 4 steps, starting at "What kind of task?". Full description follows.',
    );
    expect(d.description.split("\n")).toEqual([
      "What kind of task? → (Learning a concept) → Use AI heavily.",
      "What kind of task? → (Debugging) → Logs.",
      "Logs → Note.",
    ]);
  });

  it("includes subgraph names and LR direction", () => {
    const d = describeMermaid(
      `flowchart LR\n subgraph Index [Indexing - once]\n  A[Docs] --> B[Model]\n end`,
    );
    expect(d.alt).toContain("left to right");
    expect(d.description).toContain("Groups: Indexing - once.");
  });

  it("describes sequence diagrams using participant names", () => {
    const d = describeMermaid(
      `sequenceDiagram\n participant T as Tenant\n participant M as Model\n T->>M: Question\n M-->>T: Answer`,
    );
    expect(d.alt).toBe(
      "Sequence diagram between Tenant, Model, 2 steps. Full description follows.",
    );
    expect(d.description).toBe("1. Tenant → Model: Question\n2. Model → Tenant: Answer");
  });

  it("lets an explicit %% alt: comment override the generated alt", () => {
    expect(describeMermaid(`flowchart TD\n%% alt: How data flows into the bot\nA --> B`).alt).toBe(
      "How data flows into the bot",
    );
  });
});
