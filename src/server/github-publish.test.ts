import { describe, expect, it } from "vitest";
import { publishFile } from "./github-publish";

const target = { token: "t0k", repo: "owner/repo", branch: "main", path: "content/handbook.md" };

function fakeFetch(responses: Response[]) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const impl = (async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    return responses.shift()!;
  }) as unknown as typeof fetch;
  return { impl, calls };
}

describe("publishFile", () => {
  it("updates the file with its current sha, on the branch, as base64", async () => {
    const { impl, calls } = fakeFetch([
      Response.json({ sha: "abc123" }),
      Response.json({ commit: { sha: "c0ffee", html_url: "https://github.com/x/commit/c0ffee" } }),
    ]);
    const r = await publishFile(target, "# Book £", "Content: update", impl);
    expect(r).toEqual({
      ok: true,
      commitSha: "c0ffee",
      commitUrl: "https://github.com/x/commit/c0ffee",
    });
    expect(calls[0]!.url).toBe(
      "https://api.github.com/repos/owner/repo/contents/content/handbook.md?ref=main",
    );
    const put = JSON.parse(String(calls[1]!.init!.body));
    expect(put).toMatchObject({ message: "Content: update", branch: "main", sha: "abc123" });
    expect(Buffer.from(put.content, "base64").toString("utf8")).toBe("# Book £");
    expect((calls[1]!.init!.headers as Record<string, string>).authorization).toBe("Bearer t0k");
  });

  it("creates the file when it does not exist yet", async () => {
    const { impl, calls } = fakeFetch([
      new Response("{}", { status: 404 }),
      Response.json({ commit: { sha: "1", html_url: "u" } }),
    ]);
    expect((await publishFile(target, "x", "m", impl)).ok).toBe(true);
    expect(JSON.parse(String(calls[1]!.init!.body)).sha).toBeUndefined();
  });

  it("reports GitHub's reason when it refuses", async () => {
    const { impl } = fakeFetch([
      Response.json({ sha: "a" }),
      Response.json({ message: "Resource not accessible by integration" }, { status: 403 }),
    ]);
    expect(await publishFile(target, "x", "m", impl)).toEqual({
      ok: false,
      status: 403,
      error: "Resource not accessible by integration",
    });
  });
});
