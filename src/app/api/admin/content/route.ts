// Content import (ADR-0006): preview what a new handbook file would change, then publish it by
// committing to GitHub. Only platform owners; the previewed file is the only one that can be
// published (hash-checked), and removals that hide learner progress need an explicit yes.
import { createHash } from "node:crypto";
import { z } from "zod";
import { buildCourse } from "@/content/build-course";
import { diffManifests, type ContentDiff } from "@/content/diff";
import { generated } from "@generated/index";
import { getCourseEntry, listCourses } from "@/lib/content";
import { requireContext } from "@/server/context";
import { env } from "@/server/env";
import { publishFile } from "@/server/github-publish";
import { allow } from "@/server/rate-limit";
import { errorResponse, HttpError, requireSameOriginJson } from "@/server/session";

const MAX_BYTES = 5 * 1024 * 1024;
const NO_STORE = { "Cache-Control": "private, no-store" };
const course = z.string().refine((c) => listCourses().some((x) => x.slug === c), "unknown course");
const markdown = z.string().min(1).max(MAX_BYTES);
const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("preview"), course, markdown }),
  z.object({
    action: z.literal("publish"),
    course,
    markdown,
    hash: z.string().regex(/^[0-9a-f]{64}$/),
    acknowledgeRemovals: z.boolean().default(false),
    message: z.string().trim().max(200).optional(),
  }),
]);

const sha256 = (s: string) => createHash("sha256").update(s, "utf8").digest("hex");

function publishing() {
  const e = env();
  return e.GITHUB_PUBLISH_TOKEN && e.GITHUB_REPOSITORY
    ? { token: e.GITHUB_PUBLISH_TOKEN, repo: e.GITHUB_REPOSITORY, branch: e.GITHUB_PUBLISH_BRANCH }
    : null;
}

async function preview(slug: string, md: string) {
  const entry = getCourseEntry(slug)!;
  // The live build's diagram sizes, so unchanged diagrams don't show up as edits.
  const after = await buildCourse(md, entry, generated[slug]?.renders ?? {});
  const diff: ContentDiff = diffManifests(generated[slug]?.manifest ?? null, after.manifest);
  const published = after.manifest.pages.filter((p) => p.status === "published");
  return {
    hash: sha256(md),
    diff,
    summary: {
      parts: after.manifest.parts.length,
      published: published.length,
      comingSoon: after.manifest.pages.length - published.length,
      questions: after.cards.length,
      terms: after.glossary.length,
    },
  };
}

/** GET /api/admin/content — courses, and whether publishing to GitHub is set up. */
export async function GET(req: Request) {
  try {
    await requireContext(req, "platform:content:publish");
    const p = publishing();
    return Response.json(
      {
        courses: listCourses().map((c) => ({ slug: c.slug, source: c.source })),
        publishing: p ? { repo: p.repo, branch: p.branch } : null,
      },
      { headers: NO_STORE },
    );
  } catch (err) {
    return errorResponse(err);
  }
}

/** POST /api/admin/content — preview a new handbook file, or publish one already previewed. */
export async function POST(req: Request) {
  try {
    requireSameOriginJson(req);
    const { user } = await requireContext(req, "platform:content:publish");
    const input = schema.parse(await req.json());
    if (!(await allow(`content:${user.id}`, 30, 3600)))
      throw new HttpError(429, "Too many requests. Try again later.");

    const result = await preview(input.course, input.markdown);
    if (input.action === "preview") return Response.json(result, { headers: NO_STORE });

    if (result.hash !== input.hash)
      throw new HttpError(
        400,
        "This isn't the file you previewed. Preview it again, then publish.",
      );
    if (result.diff.identical)
      throw new HttpError(400, "Nothing to publish: the file is unchanged.");
    if (result.diff.removedKeys.length && !input.acknowledgeRemovals)
      throw new HttpError(
        400,
        "This version removes content that learners may have progress on. Confirm the removals to publish.",
      );
    const target = publishing();
    const source = getCourseEntry(input.course)!.source;
    if (!target)
      return Response.json(
        {
          error: "Publishing to GitHub isn't set up on this server.",
          instructions: [
            `Save the file as ${source} in the repository.`,
            `Run: pnpm content:diff ${source} ${input.course}`,
            `Commit and push it to the main branch; CI rebuilds and deploys the site.`,
            "Or set GITHUB_PUBLISH_TOKEN and GITHUB_REPOSITORY on the server to publish from here.",
          ],
        },
        { status: 409, headers: NO_STORE },
      );
    const published = await publishFile(
      { ...target, path: source },
      input.markdown,
      input.message ||
        `Content: update ${input.course} (published by ${user.email} from the admin screen)`,
    );
    if (!published.ok)
      throw new HttpError(
        502,
        `GitHub refused the change (${published.status}): ${published.error}`,
      );
    return Response.json(published, { headers: NO_STORE });
  } catch (err) {
    return errorResponse(err);
  }
}
