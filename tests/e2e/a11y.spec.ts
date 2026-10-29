import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const PAGES = [
  ["course home", "/learn/ai-engineering-handbook"],
  ["start page", "/learn/ai-engineering-handbook/how-to-use-this-book"],
  ["chapter 1", "/learn/ai-engineering-handbook/1-python-for-ai-engineering"],
  [
    "chapter 17",
    "/learn/ai-engineering-handbook/17-embeddings-vector-databases-and-similarity-search",
  ],
];

for (const scheme of ["light", "dark"] as const) {
  for (const [name, url] of PAGES) {
    test(`${name} has no WCAG 2.2 AA violations (${scheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto(url!);
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        .analyze();
      const summary = results.violations.map(
        (v) => `${v.id}: ${v.nodes.length} × ${v.nodes[0]?.target.join(" ")}`,
      );
      expect(summary).toEqual([]);
    });
  }
}

test("keyboard: skip link moves focus to main content", async ({ page, isMobile }) => {
  test.skip(isMobile, "keyboard journey runs on desktop");
  await page.goto("/learn/ai-engineering-handbook/1-python-for-ai-engineering");
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Skip to content" });
  await expect(skip).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#main$/);
});

test("reduced motion disables smooth scrolling", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/learn/ai-engineering-handbook/1-python-for-ai-engineering");
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior)).toBe(
    "auto",
  );
});
