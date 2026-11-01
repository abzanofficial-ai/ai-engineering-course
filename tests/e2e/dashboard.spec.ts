import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { COURSE, newEmail, signIn } from "./helpers";

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

async function noViolations(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.nodes[0]?.target.join(" ")}`)).toEqual([]);
}

test("signed out, home lists the course and starts it on its learning path", async ({
  page,
  isMobile,
}) => {
  await page.goto("/home");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Your courses");
  const card = page.getByRole("article", { name: "The AI Engineering Handbook" });
  await expect(card.getByText("Beginner → Job Ready")).toBeVisible();
  await expect(card).toContainText("29 chapters ready");
  await expect(card.getByRole("progressbar")).toHaveCount(0);
  // Wide screens add a side list (with Certificates); phones use the bottom tab bar instead.
  if (!isMobile)
    await expect(page.getByRole("navigation", { name: "Your learning" })).toContainText(
      "Certificates",
    );
  // The page never scrolls sideways on a phone.
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    page.viewportSize()!.width,
  );
  await card.getByRole("link", { name: "Start course: The AI Engineering Handbook" }).click();
  await expect(page).toHaveURL(COURSE);
});

test("signed in, home shows progress and continues where the learner left off", async ({
  page,
}) => {
  await signIn(page, newEmail("dash"), `${COURSE}/1-python-for-ai-engineering`);
  await page.getByRole("button", { name: /Got it/ }).click();
  await expect(page.locator(".save-status:visible")).toHaveText("Saved", { timeout: 10_000 });

  await page.getByRole("link", { name: "AI Engineering Handbook" }).first().click();
  await expect(page).toHaveURL(/\/home$/);
  const card = page.getByRole("article", { name: "The AI Engineering Handbook" });
  await expect(card.getByRole("progressbar")).toBeVisible();
  const activity = page.getByRole("region", { name: "My activity" });
  await expect(activity).toContainText(/\d+ XP this week/);
  await expect(activity.getByRole("table")).toContainText("(today)");
  await expect(page.getByRole("list", { name: "Up next" })).toContainText(
    "Chapter 1: Python for AI Engineering",
  );
  await expect(page.getByRole("complementary", { name: "Next steps" })).toContainText(
    "Take the checkpoint",
  );
  await card.getByRole("link", { name: "Continue: The AI Engineering Handbook" }).click();
  await expect(page).toHaveURL(/1-python-for-ai-engineering/);
});

for (const scheme of ["light", "dark"] as const) {
  test(`home has no WCAG 2.2 AA violations (${scheme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto("/home");
    await expect(page.getByRole("article")).toBeVisible();
    await noViolations(page);
    await signIn(page, newEmail(`dash-a11y-${scheme}`), "/home");
    await expect(page.getByRole("region", { name: "My activity" })).toBeVisible();
    await noViolations(page);
  });
}
