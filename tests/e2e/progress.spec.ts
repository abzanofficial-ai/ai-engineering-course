// Progress for every reader (bug fix 2026-11-05): signed-out visitors' progress on the public
// pages is kept on their device and moves into their account when they sign up; signed-in
// learners' progress is saved to their account for every part of the course.
import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { COURSE, newEmail, signIn } from "./helpers";

interface PageMeta {
  key: string;
  slug: string;
  title: string;
  status: string;
  partNumber: number;
}
const manifest = JSON.parse(
  readFileSync(".content/ai-engineering-handbook/manifest.json", "utf8"),
) as { pages: PageMeta[] };
const published = manifest.pages.filter((p) => p.status === "published");
const url = (p: PageMeta) => `${COURSE}/${p.slug}`;
const bySlug = (slug: string) => published.find((p) => p.slug === slug)!;

const HOW_TO = bySlug("how-to-use-this-book");
const CAPSTONE = bySlug("the-capstone-what-you-re-building-across-the-whole-book");
const CH1 = bySlug("1-python-for-ai-engineering");
/** The first published chapter of every part (Part 0 is "Start here"). */
const FIRST_OF_EACH_PART = published.filter(
  (p, i) => published.findIndex((q) => q.partNumber === p.partNumber) === i,
);

const NEXT = /^(Got it · next|Mark as read|Finish · go to Practise)$/;

/** Reads every Learn section of a page with the pager, as a reader would. */
async function readAll(page: Page, p: PageMeta) {
  await page.goto(url(p));
  const dots = page.locator(".dots .dot");
  const n = await dots.count();
  expect(n).toBeGreaterThan(0);
  for (let i = 0; i < n; i++) await page.getByRole("button", { name: NEXT }).click();
  return n;
}

const readDots = (page: Page) => page.locator(".dots .dot.read");
const routeMini = (page: Page, title: string) =>
  page.getByRole("link", { name: new RegExp(title) }).getByRole("img", { name: /% complete$/ });

test.describe("signed out", () => {
  for (const p of [HOW_TO, CAPSTONE]) {
    test(`"${p.title}": Mark as read completes it, on the route too, and survives a reload`, async ({
      page,
    }) => {
      const n = await readAll(page, p);
      await expect(page.getByRole("heading", { name: "Chapter complete" })).toBeVisible();
      await expect(page.getByText(`You've read all ${n} sections.`)).toBeVisible();
      await expect(page.getByText("Saved on this device", { exact: true })).toBeVisible();
      await expect(readDots(page)).toHaveCount(n);
      // Reading needs no account, so no prompt interrupts it.
      await expect(page.getByRole("dialog", { name: "Save your progress" })).toHaveCount(0);

      await page.goto(COURSE);
      await expect(routeMini(page, p.title)).toHaveAttribute("aria-label", "100% complete");
      await page.reload();
      await expect(routeMini(page, p.title)).toHaveAttribute("aria-label", "100% complete");
    });
  }

  test("Chapter 1: reading, a lab tick and a drill answer are kept on this device", async ({
    page,
  }) => {
    const n = await readAll(page, CH1);
    // The last Learn section leads into Practise.
    await expect(page.getByRole("tab", { name: /Practise/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await page.getByRole("checkbox", { name: "Step 1 done" }).click();
    // The first tick explains that it's saved here and offers an account, once.
    const prompt = page.getByRole("dialog", { name: "Save your progress" });
    await expect(prompt).toContainText("saved on this device");
    await prompt.getByRole("button", { name: "Not now" }).click();
    await page.getByRole("checkbox", { name: "Step 2 done" }).click();
    await expect(prompt).toHaveCount(0);

    await page.reload();
    await expect(readDots(page)).toHaveCount(n);
    await page.getByRole("tab", { name: /Practise/ }).click();
    await expect(page.getByRole("checkbox", { name: "Step 1 done" })).toBeChecked();
    await expect(page.getByRole("checkbox", { name: "Step 2 done" })).toBeChecked();
    await page.goto(COURSE);
    const pct = await routeMini(page, CH1.title).getAttribute("aria-label");
    expect(Number(pct!.replace("% complete", ""))).toBeGreaterThan(0);
  });

  test("home shows a visitor's progress once they've started", async ({ page }) => {
    await page.goto("/home");
    const card = page.getByRole("article", { name: "The AI Engineering Handbook" });
    await expect(card.getByRole("progressbar")).toHaveCount(0);
    await readAll(page, HOW_TO);
    await page.goto("/home");
    await expect(card.getByRole("progressbar")).toBeVisible();
    await expect(card.getByRole("link", { name: /^Continue/ })).toBeVisible();
  });

  test("unticking a step is kept too", async ({ page }) => {
    await page.goto(url(CH1));
    await page.getByRole("tab", { name: /Practise/ }).click();
    const step = page.getByRole("checkbox", { name: "Step 1 done" });
    await step.click();
    await page.getByRole("button", { name: "Not now" }).click();
    await step.click();
    await expect(step).not.toBeChecked();
    await page.reload();
    await page.getByRole("tab", { name: /Practise/ }).click();
    await expect(page.getByRole("checkbox", { name: "Step 1 done" })).not.toBeChecked();
  });

  test("with storage blocked, reading still completes the page for this visit", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      const deny = () => {
        throw new DOMException("blocked", "SecurityError");
      };
      Object.defineProperty(window, "localStorage", { get: deny, configurable: true });
    });
    const n = await readAll(page, HOW_TO);
    await expect(page.getByRole("heading", { name: "Chapter complete" })).toBeVisible();
    await expect(readDots(page)).toHaveCount(n);
  });
});

test.describe("moving between signed out and signed in", () => {
  test("a visitor's progress moves into the account they create, and follows them to another device", async ({
    page,
    browser,
  }) => {
    const n = await readAll(page, HOW_TO);
    const email = newEmail("guest-to-account");
    await signIn(page, email, COURSE);
    await expect(page.getByText("Your progress from this device has been added")).toBeVisible();
    await expect(routeMini(page, HOW_TO.title)).toHaveAttribute("aria-label", "100% complete");
    // Moved, not copied: nothing is left in the visitor's store on this device.
    expect(
      await page.evaluate(() => Object.keys(localStorage).filter((k) => k.endsWith(":guest"))),
    ).toEqual([]);

    // Another device: the progress is on the server now.
    const other = await (await browser.newContext()).newPage();
    await signIn(other, email, url(HOW_TO));
    await expect(readDots(other)).toHaveCount(n);
  });

  test("signing out on a shared device leaves nothing for the next visitor", async ({ page }) => {
    await signIn(page, newEmail("shared-device"), url(HOW_TO));
    const n = await page.locator(".dots .dot").count();
    for (let i = 0; i < n; i++) await page.getByRole("button", { name: NEXT }).click();
    await expect(page.getByRole("heading", { name: "Chapter complete" })).toBeVisible();
    await page.goto("/account");
    await page.getByRole("button", { name: "Sign out on this device" }).click();
    await expect(page).toHaveURL(/\/home$/);
    await page.goto(COURSE);
    await expect(routeMini(page, HOW_TO.title)).toHaveAttribute("aria-label", "0% complete");
  });
});

test.describe("signed in", () => {
  for (const p of FIRST_OF_EACH_PART) {
    test(`Part ${p.partNumber} (${p.title}): reading every Learn section is saved to the account`, async ({
      page,
      browser,
    }) => {
      const email = newEmail(`part${p.partNumber}`);
      await signIn(page, email, url(p));
      const n = await page.locator(".dots .dot").count();
      for (let i = 0; i < n; i++) await page.getByRole("button", { name: NEXT }).click();
      // Wait until the server has it (chapters with a lab end on the Practise tab).
      await expect(page.locator(".save-status:visible")).toHaveText("Saved");
      await expect(readDots(page)).toHaveCount(n);
      await page.reload();
      await expect(readDots(page)).toHaveCount(n);
      // Saved on the server: a second device sees it.
      const other = await (await browser.newContext()).newPage();
      await signIn(other, email, url(p));
      await expect(readDots(other)).toHaveCount(n);
    });
  }

  test("going back to re-read and reading again doesn't double-count", async ({ page }) => {
    await signIn(page, newEmail("reread"), url(HOW_TO));
    const n = await page.locator(".dots .dot").count();
    await page.getByRole("button", { name: NEXT }).click();
    await page.getByRole("button", { name: "Back" }).click();
    for (let i = 0; i < n; i++) await page.getByRole("button", { name: NEXT }).click();
    await expect(page.getByText(`You've read all ${n} sections.`)).toBeVisible();
    await page.goto(COURSE);
    await expect(routeMini(page, HOW_TO.title)).toHaveAttribute("aria-label", "100% complete");
  });

  test("skipping sections with the dots leaves the page incomplete and says how many", async ({
    page,
  }) => {
    await signIn(page, newEmail("skipper"), url(HOW_TO));
    const dots = page.locator(".dots .dot");
    const n = await dots.count();
    await dots.nth(n - 1).click();
    await page.getByRole("button", { name: "Mark as read" }).click();
    await expect(page.getByRole("heading", { name: "End of this chapter" })).toBeVisible();
    await expect(
      page.getByText(`${n - 1} earlier sections aren't marked as read yet.`),
    ).toBeVisible();
    await page.getByRole("button", { name: "Go to the first unread section" }).click();
    await expect(page.locator(".dots .dot").first()).toHaveAttribute("aria-current", "step");
  });
});
