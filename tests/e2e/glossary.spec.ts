import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { COURSE } from "./helpers";

const CH1 = `${COURSE}/1-python-for-ai-engineering`;
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

async function noViolations(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.nodes[0]?.target.join(" ")}`)).toEqual([]);
}

test("a term in the text opens its definition by tap or keyboard", async ({ page }) => {
  await page.goto(`${CH1}#what-it-is`);
  const term = page.locator('button.term-ref[data-term="sdk"]');
  await expect(term).toBeVisible();
  await term.click();
  const pop = page.getByRole("dialog", { name: "Definition: SDK" });
  await expect(pop).toBeVisible();
  await expect(pop).toContainText("Software Development Kit");
  await expect(term).toHaveAttribute("aria-expanded", "true");
  await noViolations(page);

  await page.keyboard.press("Escape");
  await expect(pop).toBeHidden();
  await expect(term).toBeFocused();

  await page.keyboard.press("Enter");
  await expect(pop).toBeVisible();
  await pop.getByRole("link", { name: "All definitions in the glossary" }).click();
  await expect(page).toHaveURL(/\/glossary#sdk$/);
  const entry = page.locator("#sdk");
  await expect(entry).toContainText("Chapter 1: Python for AI Engineering");
  await expect(entry).toContainText("Chapter 15");
});

test("hovering a term shows its definition on desktop", async ({ page, isMobile }) => {
  test.skip(isMobile, "hover is a desktop affordance; tap is covered above");
  await page.goto(`${CH1}#what-it-is`);
  await page.locator('button.term-ref[data-term="sdk"]').hover();
  await expect(page.getByRole("dialog", { name: "Definition: SDK" })).toBeVisible();
  await page.mouse.move(0, 0);
  await expect(page.getByRole("dialog", { name: "Definition: SDK" })).toBeHidden();
});

for (const scheme of ["light", "dark"] as const) {
  test(`glossary filters terms and passes axe (${scheme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto(COURSE);
    await page.getByRole("link", { name: "Glossary" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Glossary");
    await expect(page.getByRole("status").filter({ hasText: "terms" })).toHaveText("366 terms");
    await noViolations(page);
    await page.getByLabel("Filter terms").fill("asynchronous");
    await expect(page.getByRole("status").filter({ hasText: "terms" })).toContainText(
      /^\d+ of 366 terms$/,
    );
    await expect(page.locator("#asynchronous-async")).toBeVisible();
    await expect(page.locator("#sdk")).toBeHidden();
    await expect(page.getByRole("heading", { name: "S", exact: true })).toBeHidden();
  });
}
