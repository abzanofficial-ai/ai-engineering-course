// Commits a new handbook file through the GitHub contents API (ADR-0006: publish = commit).
// CI then rebuilds and deploys. The fetch function is injectable so tests never call GitHub.
export interface PublishTarget {
  token: string;
  repo: string; // owner/name
  branch: string;
  path: string; // e.g. content/handbook.md
}

export type PublishResult =
  { ok: true; commitSha: string; commitUrl: string } | { ok: false; status: number; error: string };

const API = "https://api.github.com";

export async function publishFile(
  t: PublishTarget,
  content: string,
  message: string,
  fetchImpl: typeof fetch = fetch,
): Promise<PublishResult> {
  const url = `${API}/repos/${t.repo}/contents/${t.path.split("/").map(encodeURIComponent).join("/")}`;
  const headers = {
    authorization: `Bearer ${t.token}`,
    accept: "application/vnd.github+json",
    "x-github-api-version": "2022-11-28",
    "user-agent": "handbook-lms-admin",
  };
  // The current file's blob sha is required to update it (and guards against lost updates).
  const current = await fetchImpl(`${url}?ref=${encodeURIComponent(t.branch)}`, { headers });
  if (!current.ok && current.status !== 404)
    return { ok: false, status: current.status, error: await reason(current) };
  const sha = current.ok ? ((await current.json()) as { sha: string }).sha : undefined;

  const put = await fetchImpl(url, {
    method: "PUT",
    headers: { ...headers, "content-type": "application/json" },
    body: JSON.stringify({
      message,
      content: Buffer.from(content, "utf8").toString("base64"),
      branch: t.branch,
      ...(sha ? { sha } : {}),
    }),
  });
  if (!put.ok) return { ok: false, status: put.status, error: await reason(put) };
  const body = (await put.json()) as { commit: { sha: string; html_url: string } };
  return { ok: true, commitSha: body.commit.sha, commitUrl: body.commit.html_url };
}

async function reason(res: Response): Promise<string> {
  try {
    const b = (await res.json()) as { message?: string };
    return b.message ?? res.statusText;
  } catch {
    return res.statusText;
  }
}
