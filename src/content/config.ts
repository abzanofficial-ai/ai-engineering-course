import { z } from "zod";

export const courseConfigSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/),
  title: z.string().optional(),
  source: z.string(),
  /** Entitlement product that grants access (ADR-0010). */
  product: z.string(),
  /** Page keys readable without an account; `*` wildcard suffix allowed (ADR-0015). */
  publicPages: z.array(z.string()).default([]),
});

export const coursesFileSchema = z.object({ courses: z.array(courseConfigSchema).min(1) });

export type CourseEntry = z.infer<typeof courseConfigSchema>;

export function isPublicPage(patterns: string[], pageKey: string): boolean {
  return patterns.some((p) =>
    p.endsWith("*") ? pageKey.startsWith(p.slice(0, -1)) : p === pageKey,
  );
}
