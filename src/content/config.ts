import { z } from "zod";

export const courseConfigSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/),
  title: z.string().optional(),
  source: z.string(),
  /** Entitlement product that grants access (ADR-0010). */
  product: z.string(),
  /** Dashboard card (ADR-0028): taken from the course's own wording, never invented. */
  level: z.string().max(40).optional(),
  summary: z.string().max(280).optional(),
  icon: z.enum(["route", "brain", "prompt", "blocks"]).default("route"),
});

export const coursesFileSchema = z.object({ courses: z.array(courseConfigSchema).min(1) });

export type CourseEntry = z.infer<typeof courseConfigSchema>;

export function isPublicPage(patterns: string[], pageKey: string): boolean {
  return patterns.some((p) =>
    p.endsWith("*") ? pageKey.startsWith(p.slice(0, -1)) : p === pageKey,
  );
}
