import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { COURSE, newEmail, signIn } from "./helpers";

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

test("the landing page is ready for search engines and social sharing", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/become an AI engineer, from zero to hired/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("From zero to AI engineer");
  const meta = (sel: string) => page.locator(sel).first().getAttribute("content");
  expect(await meta('meta[name="description"]')).toContain("beginner to job-ready AI engineer");
  expect(await page.locator('link[rel="canonical"]').getAttribute("href")).toMatch(
    /^https?:\/\/[^/]+\/?$/,
  );
  expect(await meta('meta[property="og:title"]')).toContain("from zero to hired");
  expect(await meta('meta[property="og:image"]')).toMatch(/\/opengraph-image/);
  expect(await meta('meta[name="twitter:card"]')).toBe("summary_large_image");

  const ld = JSON.parse((await page.locator('script[type="application/ld+json"]').textContent())!);
  const course = ld.find((x: { "@type": string }) => x["@type"] === "Course");
  const faq = ld.find((x: { "@type": string }) => x["@type"] === "FAQPage");
  expect(course.name).toBe("The AI Engineering Handbook");
  expect(course.syllabusSections).toHaveLength(15);
  expect(faq.mainEntity.length).toBeGreaterThanOrEqual(5);

  // The numbers come from the course itself.
  await expect(page.getByText("Hands-on lab steps")).toBeVisible();
  await expect(page.locator(".lp-stats")).toContainText("231");
  await expect(page.locator("#route")).toContainText("29 of 47 chapters are ready today");
  // No promises the course can't keep.
  await expect(page.locator("main")).not.toContainText(/guarantee|\$200,000|200k/i);
});

test("calls to action lead into the course; the route expands", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "See the route" }).click();
  const part8 = page.getByText("Part 8 · RAG");
  await expect(part8).toBeVisible();
  await part8.click();
  await expect(page.getByText("Chapter 18: The RAG Pipeline & Document Processing")).toBeVisible();
  await page.getByRole("link", { name: "Start free with Chapter 1" }).click();
  await expect(page).toHaveURL(`${COURSE}/1-python-for-ai-engineering`);
});

for (const scheme of ["light", "dark"] as const) {
  test(`the landing page has no WCAG 2.2 AA violations (${scheme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
    await page.goto("/");
    const axe = await new AxeBuilder({ page }).withTags(TAGS).analyze();
    expect(axe.violations.map((v) => `${v.id}: ${v.nodes[0]?.target.join(" ")}`)).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      page.viewportSize()!.width,
    );
  });
}

test("signed-in learners skip the landing page and go to their dashboard", async ({ page }) => {
  await signIn(page, newEmail("landing"), "/home");
  await page.goto("/");
  await expect(page).toHaveURL(/\/home$/);
});

test("sitemap lists only public pages; robots keeps private ones out", async ({ request }) => {
  const sitemap = await (await request.get("/sitemap.xml")).text();
  // Absolute URLs use APP_URL from build time (set it before building for production).
  expect(sitemap).toMatch(/<loc>https?:\/\/[^<]+\/<\/loc>/);
  expect(sitemap).toContain(`${COURSE}/1-python-for-ai-engineering</loc>`);
  expect(sitemap).not.toContain("21-tool-calling");
  const robots = await (await request.get("/robots.txt")).text();
  expect(robots).toContain("Disallow: /admin");
  expect(robots).toMatch(/Sitemap: https?:\/\/\S+\/sitemap\.xml/);
  const og = await request.get("/opengraph-image");
  expect(og.headers()["content-type"]).toBe("image/png");
});
