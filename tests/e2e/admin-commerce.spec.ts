import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { COURSE, newEmail, signIn } from "./helpers";

// ADMIN_EMAILS=owner@example.test is set for the e2e server (playwright.config.ts).
test("owner creates a seat pack, a learner joins with the code, the owner sees it used", async ({
  page,
  browser,
  isMobile,
}) => {
  test.skip(isMobile, "an admin task done on a computer");
  await signIn(page, "owner@example.test", "/admin/commerce");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Access and centres");
  const packs = page.getByRole("region", { name: "Seat packs" }).first();
  const org = `Example Training ${Date.now()}`;
  await page.getByLabel("Centre name").fill(org);
  await page.getByLabel("Seats").fill("2");
  await page.getByRole("button", { name: "Create seat pack" }).click();
  const code = (await page
    .getByRole("status")
    .filter({ hasText: "Join code for" })
    .locator("output")
    .textContent())!;
  expect(code).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
  const axe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(axe.violations.map((v) => v.id)).toEqual([]);

  const learner = await (await browser.newContext()).newPage();
  await signIn(learner, newEmail("pupil"), "/join");
  await learner.getByLabel("Join code").fill(code.toLowerCase());
  await learner.getByRole("button", { name: "Join the course" }).click();
  await expect(learner.getByRole("heading", { name: "You're in" })).toBeVisible();
  await expect(learner.getByText(`Your place from ${org}`)).toBeVisible();
  await learner.getByRole("link", { name: "Start learning" }).click();
  await expect(learner).toHaveURL(COURSE);

  await page.reload();
  await expect(packs.getByRole("row", { name: new RegExp(org) })).toContainText("1 / 2");
  await expect(page.getByText(code)).toHaveCount(0); // never shown again
});

test("the admin screen is invisible to learners", async ({ page }) => {
  await signIn(page, newEmail("nosy"), "/");
  const res = await page.goto("/admin/commerce");
  expect(res!.status()).toBe(404);
});
