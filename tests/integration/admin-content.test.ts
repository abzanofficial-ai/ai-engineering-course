// Content import from the admin screen (ADR-0006): preview against the live content, protect
// learner progress from silent removals, publish only the previewed file, never call GitHub in
// tests. Uses the real handbook with two small edits.
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as route from "@/app/api/admin/content/route";
import { resetEnvForTests } from "@/server/env";
import { req, signIn } from "./auth-helpers";
import { COURSE } from "./helpers";

const original = readFileSync("content/handbook.md", "utf8");
const QUESTION = "- How would you handle 100 concurrent LLM requests?\n";
const edited = original
  .replace("A readable, forgiving language", "A readable, forgiving and popular language")
  .replace(QUESTION, "");

const post = (cookie: string | null, json: unknown) =>
  route.POST(req("/api/admin/content", cookie, { method: "POST", json }));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  resetEnvForTests();
});

describe("admin content", { timeout: 120_000 }, () => {
  it("only platform owners can use it", async () => {
    const learner = await signIn("content-learner@example.test");
    expect((await route.GET(req("/api/admin/content", learner))).status).toBe(403);
    expect(
      (await post(learner, { action: "preview", course: COURSE, markdown: "# x" })).status,
    ).toBe(403);
    expect((await route.GET(req("/api/admin/content", null))).status).toBe(401);
  });

  it("previews exactly what would change, including progress that would be hidden", async () => {
    const owner = await signIn("owner@example.test");
    const same = await (
      await post(owner, { action: "preview", course: COURSE, markdown: original })
    ).json();
    expect(same.diff.identical).toBe(true);

    const res = await post(owner, { action: "preview", course: COURSE, markdown: edited });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(body.diff.identical).toBe(false);
    const ch1 = body.diff.changedPages.find((c: { key: string }) => c.key === "ch-1");
    expect(ch1.changedSections).toContain("what-it-is");
    expect(ch1.removedCards).toBe(1);
    // Only Chapter 1 changed: unchanged chapters (and their diagrams) must not show as edits.
    expect(body.diff.changedPages.map((c: { key: string }) => c.key)).toEqual(["ch-1"]);
    expect(ch1.changedSections).toEqual(["what-it-is", "interview"]);
    expect(body.diff.removedKeys).toEqual([
      expect.objectContaining({ pageKey: "ch-1", kind: "card" }),
    ]);
    expect(body.summary.questions).toBe(199);
  });

  it("publishes only the previewed file, needs consent for removals, and explains when GitHub isn't set up", async () => {
    const owner = await signIn("owner@example.test");
    const { hash } = await (
      await post(owner, { action: "preview", course: COURSE, markdown: edited })
    ).json();

    const tampered = await post(owner, {
      action: "publish",
      course: COURSE,
      markdown: edited + "\nextra",
      hash,
    });
    expect(tampered.status).toBe(400);
    expect((await tampered.json()).error).toMatch(/isn't the file you previewed/);

    const noConsent = await post(owner, {
      action: "publish",
      course: COURSE,
      markdown: edited,
      hash,
    });
    expect(noConsent.status).toBe(400);
    expect((await noConsent.json()).error).toMatch(/Confirm the removals/);

    const notSetUp = await post(owner, {
      action: "publish",
      course: COURSE,
      markdown: edited,
      hash,
      acknowledgeRemovals: true,
    });
    expect(notSetUp.status).toBe(409);
    const help = await notSetUp.json();
    expect(help.instructions.join(" ")).toContain("pnpm content:diff content/handbook.md");

    const unchanged = await post(owner, {
      action: "publish",
      course: COURSE,
      markdown: original,
      hash: (
        await (await post(owner, { action: "preview", course: COURSE, markdown: original })).json()
      ).hash,
    });
    expect(unchanged.status).toBe(400);
  });

  it("commits through the GitHub API when a token is configured", async () => {
    vi.stubEnv("GITHUB_PUBLISH_TOKEN", "test-token-not-real");
    vi.stubEnv("GITHUB_REPOSITORY", "example/handbook");
    const calls: { url: string; init?: RequestInit }[] = [];
    const realFetch = globalThis.fetch;
    vi.stubGlobal("fetch", async (url: string | URL | Request, init?: RequestInit) => {
      const u = String(url);
      if (!u.startsWith("https://api.github.com/")) return realFetch(url, init);
      calls.push({ url: u, init });
      return init?.method === "PUT"
        ? Response.json({
            commit: { sha: "abc", html_url: "https://github.com/example/handbook/commit/abc" },
          })
        : Response.json({ sha: "old-blob" });
    });
    resetEnvForTests();

    const owner = await signIn("owner@example.test");
    const status = await (await route.GET(req("/api/admin/content", owner))).json();
    expect(status.publishing).toEqual({ repo: "example/handbook", branch: "main" });
    const { hash } = await (
      await post(owner, { action: "preview", course: COURSE, markdown: edited })
    ).json();
    const res = await post(owner, {
      action: "publish",
      course: COURSE,
      markdown: edited,
      hash,
      acknowledgeRemovals: true,
      message: "Content: tidy Chapter 1",
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, commitSha: "abc" });
    const put = calls.find((c) => c.init?.method === "PUT")!;
    expect(put.url).toBe(
      "https://api.github.com/repos/example/handbook/contents/content/handbook.md",
    );
    expect(JSON.parse(String(put.init!.body))).toMatchObject({
      message: "Content: tidy Chapter 1",
      branch: "main",
      sha: "old-blob",
    });
    resetEnvForTests();
  });
});
