import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { COURSE, newEmail, signIn } from "./helpers";

// Regression: on the last section of a chapter without a lab, "Mark as read" saved the section
// but nothing visible happened, so it looked broken.
const GUIDE = `${COURSE}/how-to-use-this-book`;
const LAST = "why-learn-this-yourself-when-ai-can-write-the-code";

test("finishing a chapter without a lab confirms it and offers what is next", async ({ page }) => {
  await signIn(page, newEmail("chapter-end"), GUIDE);
  for (let i = 0; i < 6; i++) await page.getByRole("button", { name: "Got it · next" }).click();
  await page.getByRole("button", { name: "Mark as read" }).click();

  const done = page.getByRole("region", { name: "Chapter complete" });
  await expect(done).toBeVisible();
  await expect(done).toContainText("You've read all 7 sections.");
  await expect(done.getByRole("heading", { name: "Chapter complete" })).toBeFocused();
  await expect(page.locator(".save-status:visible")).toHaveText("Saved", { timeout: 10_000 });
  const axe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(axe.violations.map((v) => v.id)).toEqual([]);

  await done.getByRole("link", { name: /^Next: The capstone/ }).click();
  await expect(page).toHaveURL(/the-capstone-what-you-re-building/);
});

test("skipping ahead says how many sections are unread and goes back to them", async ({ page }) => {
  await signIn(page, newEmail("chapter-skip"), `${GUIDE}#${LAST}`);
  await page.getByRole("button", { name: "Mark as read" }).click();
  const done = page.getByRole("region", { name: "End of this chapter" });
  await expect(done).toContainText("6 earlier sections aren't marked as read yet.");
  await done.getByRole("button", { name: "Go to the first unread section" }).click();
  await expect(page.getByRole("heading", { level: 3, name: "Introduction" })).toBeVisible();
});

test("signed out, the end of a public chapter still shows what is next", async ({ page }) => {
  await page.goto(`${GUIDE}#${LAST}`);
  await page.getByRole("button", { name: "Mark as read" }).click();
  const done = page.getByRole("region", { name: "End of this chapter" });
  await expect(done).toContainText("Create a free account");
  await expect(done.getByRole("link", { name: "Back to the course" })).toHaveAttribute(
    "href",
    COURSE,
  );
});
