import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("search finds a lab and deep-links into Practise mode", async ({ page }) => {
  await page.goto("/learn/ai-engineering-handbook");
  await page.getByRole("link", { name: "Search the course" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Search");
  await page.getByLabel("Search the whole course").fill("CSV-processing skeleton");
  const hit = page.getByRole("link", { name: /Practice lab: build the CSV-processing skeleton/ });
  await expect(hit).toBeVisible();
  await expect(page).toHaveURL(/\/search\?q=CSV-processing/);
  await hit.click();
  await expect(page).toHaveURL(/1-python-for-ai-engineering#lab$/);
  await expect(page.getByRole("tab", { name: /Practise/ })).toHaveAttribute(
    "aria-selected",
    "true",
  );
});

test("a search query survives reload and shows matches highlighted", async ({ page }) => {
  await page.goto("/search?q=idempotency");
  await expect(page.locator(".result").first()).toBeVisible();
  await expect(page.locator(".result-excerpt mark").first()).toBeVisible();
  await expect(page.getByLabel("Search the whole course")).toHaveValue("idempotency");
});

for (const scheme of ["light", "dark"] as const) {
  test(`search page has no WCAG 2.2 AA violations (${scheme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto("/search?q=prompt");
    await expect(page.locator(".result").first()).toBeVisible();
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.nodes[0]?.target.join(" ")}`)).toEqual([]);
  });
}
