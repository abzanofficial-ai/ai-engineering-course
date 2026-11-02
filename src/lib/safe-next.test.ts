import { describe, expect, it } from "vitest";
import { safeNext } from "./safe-next";

describe("safeNext", () => {
  it("keeps same-site paths, with query and hash", () => {
    expect(safeNext("/learn/ai/ch-1?mode=lab#s2")).toBe("/learn/ai/ch-1?mode=lab#s2");
    expect(safeNext("/")).toBe("/");
  });

  it("falls back when missing or not a path", () => {
    expect(safeNext(undefined)).toBe("/");
    expect(safeNext(null)).toBe("/");
    expect(safeNext("")).toBe("/");
    expect(safeNext("learn")).toBe("/");
    expect(safeNext("https://evil.example/")).toBe("/");
    expect(safeNext("javascript:alert(1)")).toBe("/");
    expect(safeNext("x", "/home")).toBe("/home");
  });

  it.each([
    "//evil.example",
    "/\\evil.example",
    "/\\/evil.example",
    "/\t/evil.example",
    "/\n/evil.example",
    "//\\evil.example",
    "///evil.example",
  ])("refuses %j, which a browser would send to another site", (raw) => {
    expect(safeNext(raw)).toBe("/");
  });

  it("normalises dot segments without leaving the site", () => {
    expect(safeNext("/a/../../b")).toBe("/b");
  });
});
