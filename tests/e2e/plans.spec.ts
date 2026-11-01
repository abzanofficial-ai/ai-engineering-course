import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { newEmail, signIn } from "./helpers";

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

test("the plans page shows the three offers from the price list", async ({ page }) => {
  await page.goto("/plans");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Plans");
  await expect(page.getByText("every signed-in learner gets the full course free")).toBeVisible();
  for (const name of ["Monthly", "Annual", "Lifetime", "Centre licence", "Seat pack"])
    await expect(page.getByRole("heading", { level: 3, name })).toBeVisible();
  await expect(page.getByText("Includes 30 active learners a month")).toBeVisible();
  await expect(page.getByRole("link", { name: "enter it here" })).toHaveAttribute("href", "/join");
  const axe = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  expect(axe.violations.map((v) => v.id)).toEqual([]);
});

test("join needs an account; a wrong code explains itself; Account shows access", async ({
  page,
}) => {
  await page.goto("/join");
  await expect(page).toHaveURL(/\/sign-in\?next=%2Fjoin/);
  await signIn(page, newEmail("join"), "/join");
  await page.getByLabel("Join code").fill("aaaa-bbbb-cccc");
  await page.getByRole("button", { name: "Join the course" }).click();
  await expect(page.locator("#join-error")).toContainText("That code isn't valid");
  const axe = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  expect(axe.violations.map((v) => v.id)).toEqual([]);

  await page.goto("/account");
  const access = page.getByRole("region", { name: "Your access" });
  await expect(access).toContainText("You have the full course free while we launch.");
  await expect(access.getByRole("link", { name: "Join with a code" })).toHaveAttribute(
    "href",
    "/join",
  );
});
