import { describe, expect, it } from "vitest";
import { generated } from "@generated/index";
import { needsSession } from "./access";

const courses = [
  {
    slug: "ai-engineering-handbook",
    manifest: generated["ai-engineering-handbook"]!.manifest,
    publicPages: ["start-*", "ch-1"],
  },
];
const L = "/learn/ai-engineering-handbook";

describe("needsSession", () => {
  it.each([
    [L, false],
    [`${L}/how-to-use-this-book`, false],
    [`${L}/1-python-for-ai-engineering`, false],
    [`${L}/2-git-and-github`, true],
    [`${L}/21-tool-calling-and-function-calling`, true],
    ["/account", true],
    ["/progress", true],
    ["/admin/content", true],
    ["/sign-in", false],
    ["/review", true],
    ["/notes", true],
    ["/certificates", true],
    ["/certificates/AbCdEfGhIjKlMnOpQrStUv", false],
    ["/search", false],
    [`${L}/glossary`, false],
    [`${L}/checkpoint/1`, true],
    ["/learn/unknown-course/x", false],
  ])("%s → %s", (path, expected) => expect(needsSession(path, courses)).toBe(expected));
});
