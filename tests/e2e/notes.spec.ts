import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { COURSE, newEmail, signIn } from "./helpers";

const CH1 = `${COURSE}/1-python-for-ai-engineering`;
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

async function noViolations(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.nodes[0]?.target.join(" ")}`)).toEqual([]);
}

const saved = (page: Page) =>
  expect(page.locator(".save-status:visible")).toHaveText("Saved", { timeout: 10_000 });

test("bookmark and notes on a section persist, show on the notes page, and render as text", async ({
  page,
}) => {
  await signIn(page, newEmail("notes"), `${CH1}#what-it-is`);
  const section = page.locator("article#what-it-is");

  await section.getByRole("button", { name: "Bookmark: What it is" }).click();
  await expect(section.getByRole("button", { name: "Bookmark: What it is" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  await section.getByRole("button", { name: "Add note: What it is" }).click();
  await section.getByLabel(/Your note/).fill("Python first <b>because</b> every SDK ships it");
  await noViolations(page);
  await section.getByRole("button", { name: "Save note" }).click();
  const notes = section.getByRole("list", { name: "Your notes on: What it is" });
  // The learner's text is shown exactly as typed, never as HTML.
  await expect(notes.locator(".note-body")).toHaveText(
    "Python first <b>because</b> every SDK ships it",
  );
  await expect(notes.locator("b")).toHaveCount(0);

  await notes.getByRole("button", { name: "Edit" }).click();
  await section.getByLabel(/Edit your note/).fill("Python first: every SDK ships it");
  await section.getByRole("button", { name: "Save note" }).click();
  await expect(notes.locator(".note-body")).toHaveText("Python first: every SDK ships it");
  await saved(page);

  await page.reload();
  await expect(
    page.locator("article#what-it-is").getByRole("list", { name: /Your notes on/ }),
  ).toContainText("Python first: every SDK ships it");

  await page.goto(COURSE);
  await page.getByRole("link", { name: "Notes and bookmarks" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Notes and bookmarks");
  const chapter = page.getByRole("region", { name: /Chapter 1/ });
  await expect(chapter.getByRole("link", { name: "What it is" }).first()).toBeVisible();
  await expect(chapter).toContainText("Python first: every SDK ships it");
  await noViolations(page);

  await chapter.getByRole("link", { name: "What it is" }).first().click();
  await expect(page).toHaveURL(/#what-it-is$/);
  page.once("dialog", (d) => d.accept());
  await page.locator("article#what-it-is").getByRole("button", { name: "Delete" }).click();
  await expect(page.locator("article#what-it-is .note")).toHaveCount(0);
  await saved(page);
  await page.reload();
  await expect(page.locator("article#what-it-is .note")).toHaveCount(0);
});

test("a lab can be bookmarked", async ({ page }) => {
  await signIn(page, newEmail("bookmark-lab"), `${CH1}#lab`);
  const button = page.getByRole("button", { name: /^Bookmark: Practice lab/ });
  await button.click();
  await expect(button).toHaveAttribute("aria-pressed", "true");
  await saved(page);
  await page.goto("/notes");
  await expect(
    page.getByRole("link", { name: /Practice lab: build the CSV-processing/ }),
  ).toBeVisible();
});

test("signed out, the notes page asks you to sign in", async ({ page }) => {
  await page.goto("/notes");
  await expect(page).toHaveURL(/\/sign-in\?next=%2Fnotes/);
});
