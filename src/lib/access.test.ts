import { describe, expect, it } from "vitest";
import { generated } from "@generated/index";
import { needsSession, paidCourse } from "./access";

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
    ["/join", true],
    ["/plans", false],
    ["/certificates/AbCdEfGhIjKlMnOpQrStUv", false],
    ["/search", false],
    [`${L}/glossary`, false],
    [`${L}/checkpoint/1`, true],
    ["/learn/unknown-course/x", false],
  ])("%s → %s", (path, expected) => expect(needsSession(path, courses)).toBe(expected));
});

describe("paidCourse (ADR-0030)", () => {
  const free = ["start-*", "part:1"];
  it.each([
    [`${L}/1-python-for-ai-engineering`, null], // public
    [`${L}/2-git-and-github`, null], // free tier (Part 1)
    [`${L}/21-tool-calling-and-function-calling`, "ai-engineering-handbook"],
    [`${L}/checkpoint/1`, null],
    [`${L}/checkpoint/5`, "ai-engineering-handbook"],
    [`${L}/glossary`, null],
    [`${L}`, null],
    ["/notes", null],
  ])("%s → %s", (path, expected) => expect(paidCourse(path, courses, free)).toBe(expected));
});
