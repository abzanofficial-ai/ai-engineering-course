import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { magicLinkFor, newEmail, signIn } from "./helpers";

// ADMIN_EMAILS includes owner-analytics@example.test for the e2e server (playwright.config.ts).
test("a visitor from a tagged link signs up, and the owner sees that source", async ({
  page,
  browser,
  isMobile,
}) => {
  test.skip(isMobile, "one journey is enough; the admin screen is used on a computer");
  const source = `e2e-${Date.now()}`;
  await page.goto(`/?utm_source=${source}&utm_medium=social&utm_campaign=launch`);
  // Moving around the site keeps the source in memory (no cookies, no storage).
  await page.getByRole("link", { name: "Create a free account" }).click();
  await expect(page).toHaveURL(/\/sign-in/);
  const email = newEmail("tagged");
  await page.getByLabel("Email address").fill(email);
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
  const link = await magicLinkFor(email);
  // The source travels on the sign-in link, so it works on another device too.
  expect(decodeURIComponent(link)).toContain(`utm_source=${source}`);
  await page.goto(link);
  await expect(page.getByRole("link", { name: /Your progress/ })).toBeVisible();
  // Recorded, then removed from the address bar.
  await expect(page).not.toHaveURL(/utm_source/);
  expect(await page.context().cookies()).not.toContainEqual(
    expect.objectContaining({ name: expect.stringMatching(/utm|source|visit/i) }),
  );

  const owner = await (await browser.newContext()).newPage();
  await signIn(owner, "owner-analytics@example.test", "/admin/analytics");
  await expect(owner.getByRole("heading", { level: 1 })).toHaveText("Analytics");
  const row = owner.getByRole("row", { name: new RegExp(source) });
  await expect(row).toBeVisible();
  // Medium, visits, new learners, conversion.
  await expect(row.getByRole("cell")).toHaveText(["social", "1", "1", "100%"]);
  const axe = await new AxeBuilder({ page: owner })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(axe.violations.map((v) => v.id)).toEqual([]);
});
