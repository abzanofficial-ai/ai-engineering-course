// Shows what publishing a new handbook file would change (ADR-0006).
// Usage: pnpm content:diff path/to/new-handbook.md [course-slug]
import { readFileSync } from "node:fs";
import path from "node:path";
import { buildCourse } from "../src/content/build-course";
import { coursesFileSchema } from "../src/content/config";
import { diffManifests, formatDiff } from "../src/content/diff";

const [file, slug] = process.argv.slice(2);
if (!file) {
  console.error("Usage: pnpm content:diff <new-file.md> [course-slug]");
  process.exit(2);
}
const { courses } = coursesFileSchema.parse(
  JSON.parse(readFileSync("content/courses.json", "utf8")),
);
const course = courses.find((c) => c.slug === (slug ?? courses[0]!.slug));
if (!course) throw new Error(`Unknown course ${slug}`);
const before = await buildCourse(readFileSync(course.source, "utf8"), course);
const after = await buildCourse(readFileSync(path.resolve(file), "utf8"), course);
console.log(formatDiff(diffManifests(before.manifest, after.manifest)));
